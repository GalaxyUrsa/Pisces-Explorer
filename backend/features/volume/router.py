"""Three-dimensional volume route."""

from __future__ import annotations

from typing import Annotated, Literal, Optional

from fastapi import APIRouter, HTTPException, Query

from ...core.runtime import runtime
from ...core.spatial import crop_frame
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
    region: Annotated[Optional[str], Query()] = None,
    quality: Annotated[Literal["full", "preview"], Query()] = "full",
):
    runtime.require_data()
    if variable not in VARS_3D:
        raise HTTPException(
            status_code=400, detail=f"variable must be one of {VARS_3D}"
        )

    try:
        frame = crop_frame(runtime.get_frame(date_idx), region)
    except (ValueError, TypeError) as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    data = runtime.get_scalar_data(variable, frame)
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
    if (
        quality == "full"
        and not runtime.is_series
        and uses_defaults
        and region is None
    ):
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
        sample_step=16 if quality == "preview" else 8,
        max_depth_layers=4 if quality == "preview" else None,
    )
