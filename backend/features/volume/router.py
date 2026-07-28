"""Three-dimensional volume route."""

from __future__ import annotations

from typing import Annotated, Optional

import numpy as np
from fastapi import APIRouter, HTTPException, Query

from ...core.runtime import runtime
from ...core.variables import VARS_3D
from .figure import make_volume_fig
from .service import ensure_volume


router = APIRouter(prefix="/api", tags=["volume"])


@router.get("/volume")
def get_volume(
    variable: Annotated[str, Query()] = "ss",
    cmin: Annotated[Optional[float], Query()] = None,
    cmax: Annotated[Optional[float], Query()] = None,
    colorscale: Annotated[Optional[str], Query()] = None,
    color_min: Annotated[Optional[str], Query()] = None,
    color_max: Annotated[Optional[str], Query()] = None,
    layers: Annotated[Optional[str], Query()] = None,
    date_idx: Annotated[int, Query()] = 0,
):
    runtime.require_data()
    if variable not in VARS_3D:
        raise HTTPException(
            status_code=400, detail=f"variable must be one of {VARS_3D}"
        )

    frame = runtime.get_frame(date_idx)
    data = runtime.get_data(variable, frame)
    if isinstance(data, tuple):
        data = np.sqrt(data[0] ** 2 + data[1] ** 2)
    custom = [color_min, color_max] if color_min and color_max else None
    depth_indices = None
    if layers is not None:
        try:
            depth_indices = [
                int(index) for index in layers.split(",") if index.strip()
            ]
        except ValueError:
            pass

    uses_defaults = all(
        value is None
        for value in (cmin, cmax, colorscale, custom, depth_indices)
    )
    if not runtime.is_series and uses_defaults:
        return ensure_volume(runtime, variable)
    return make_volume_fig(
        data,
        frame["lats"],
        frame["lons"],
        frame["depths"],
        variable=variable,
        vmin=cmin,
        vmax=cmax,
        colorscale=None if custom else colorscale,
        colorscale_custom=custom,
        depth_indices=depth_indices,
    )
