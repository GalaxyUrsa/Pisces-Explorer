"""Horizontal layer map route."""

from __future__ import annotations

import json
from typing import Annotated, Optional

import numpy as np
from fastapi import APIRouter, HTTPException, Query

from ...core.runtime import current_runtime_scope, runtime
from ...core.spatial import crop_frame, parse_region
from ...core.variables import VARIABLES, VARS_2D, VARS_VECTOR, get_variable
from .figure import make_layer_fig
from ..region.interpolation import json_safe, region_display_layer


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
    step: Annotated[int, Query(ge=1)] = 20,
    region: Annotated[Optional[str], Query()] = None,
):
    runtime.require_data()
    if variable not in VARIABLES:
        raise HTTPException(
            status_code=400, detail=f"variable must be one of {VARIABLES}"
        )
    try:
        frame = crop_frame(runtime.get_frame(date_idx), region)
    except (ValueError, TypeError, json.JSONDecodeError) as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
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

    heatmap_data = runtime.get_scalar_data(variable, frame)
    display_lats, display_lons = frame["lats"], frame["lons"]
    if current_runtime_scope() == "region":
        selection = runtime.state.get("region_selection")
        display_bounds = parse_region(region) if region else selection["bounds"]
        display = region_display_layer(
            runtime, frame, variable, depth_idx, is_2d, display_bounds
        )
        heatmap_data = display["scalar"]
        display_lats, display_lons = display["lats"], display["lons"]
        if display["components"] is not None and variable in VARS_VECTOR | {"mwd"}:
            quiver = (*display["components"], step)

    quiver_metadata = {}
    figure = make_layer_fig(
        heatmap_data,
        display_lats,
        display_lons,
        depths,
        actual_depth_idx,
        selected_points,
        variable=variable,
        vmin=vmin,
        vmax=vmax,
        colorscale=None if custom else colorscale,
        colorscale_custom=custom,
        quiver_uv=quiver,
        quiver_metadata=quiver_metadata,
        is_2d=is_2d,
        plot_step=1 if current_runtime_scope() == "region" else 2,
        json_safe_nan=current_runtime_scope() == "region",
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
    response = {
        "figure": figure,
        "title": title,
        "quiver": quiver_metadata or None,
    }
    return json_safe(response) if current_runtime_scope() == "region" else response
