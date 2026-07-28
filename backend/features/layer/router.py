"""Horizontal layer map route."""

from __future__ import annotations

import json
from typing import Annotated, Optional

import numpy as np
from fastapi import APIRouter, HTTPException, Query

from ...core.runtime import runtime
from ...core.variables import VARIABLES, VARS_2D, VARS_VECTOR, get_variable
from .figure import make_layer_fig


router = APIRouter(prefix="/api", tags=["layer"])


@router.get("/layer/{depth_idx}")
def get_layer(
    depth_idx: int,
    variable: Annotated[str, Query()] = "ss",
    points: Annotated[Optional[str], Query()] = None,
    cmin: Annotated[Optional[float], Query()] = None,
    cmax: Annotated[Optional[float], Query()] = None,
    colorscale: Annotated[Optional[str], Query()] = None,
    color_min: Annotated[Optional[str], Query()] = None,
    color_max: Annotated[Optional[str], Query()] = None,
    date_idx: Annotated[int, Query()] = 0,
    step: Annotated[int, Query()] = 20,
):
    runtime.require_data()
    if variable not in VARIABLES:
        raise HTTPException(
            status_code=400, detail=f"variable must be one of {VARIABLES}"
        )
    frame = runtime.get_frame(date_idx)
    depths = frame["depths"]
    is_2d = variable in VARS_2D
    if not is_2d and not 0 <= depth_idx < len(depths):
        raise HTTPException(status_code=400, detail="depth_idx out of range")

    selected_points = []
    if points:
        try:
            selected_points = json.loads(points)
        except json.JSONDecodeError as error:
            raise HTTPException(
                status_code=400, detail="Invalid points JSON"
            ) from error

    state = runtime.state
    vmin = cmin if cmin is not None else state.get(f"{variable}_min")
    vmax = cmax if cmax is not None else state.get(f"{variable}_max")
    data = runtime.get_data(variable, frame)
    custom = [color_min, color_max] if color_min and color_max else None

    if is_2d:
        if isinstance(data, tuple):
            u_surface, v_surface = data
        else:
            u_surface, v_surface = data, None
        actual_depth_idx = 0
    else:
        if isinstance(data, tuple):
            u_surface = data[0][depth_idx]
            v_surface = data[1][depth_idx]
        else:
            u_surface, v_surface = data, None
        actual_depth_idx = depth_idx

    quiver = (
        (u_surface, v_surface, step)
        if variable in VARS_VECTOR and v_surface is not None
        else None
    )
    if variable == "mwd":
        mwd_u, mwd_v = frame.get("mwd_u"), frame.get("mwd_v")
        if mwd_u is not None and mwd_v is not None:
            quiver = (mwd_u, mwd_v, step)

    if variable in VARS_VECTOR and v_surface is not None:
        heatmap_data = np.sqrt(u_surface ** 2 + v_surface ** 2)
    elif is_2d:
        heatmap_data = u_surface
    else:
        heatmap_data = data

    figure = make_layer_fig(
        heatmap_data,
        frame["lats"],
        frame["lons"],
        depths,
        actual_depth_idx,
        selected_points,
        variable=variable,
        vmin=vmin,
        vmax=vmax,
        colorscale=None if custom else colorscale,
        colorscale_custom=custom,
        quiver_uv=quiver,
        is_2d=is_2d,
    )
    label = get_variable(variable).label
    date_label = f"  [{frame['date']}]" if runtime.is_series else ""
    if is_2d:
        title = f"{label}（表面层）{date_label}"
    else:
        title = (
            f"{label}  {float(depths[depth_idx]):.1f} m"
            f"（第 {depth_idx + 1}/{len(depths)} 层）{date_label}"
        )
    return {"figure": figure, "title": title}
