"""Two-point vertical-transect route."""

from fastapi import APIRouter, HTTPException

from ...core.runtime import runtime
from ...core.spatial import point_in_region
from ...core.variables import VARS_3D
from ..comparison.service import resolve_analysis_data
from .figure import make_transect_fig
from .schema import TransectRequest


router = APIRouter(prefix="/api", tags=["transect"])


@router.post("/transect")
def get_transect(request: TransectRequest):
    runtime.require_data()
    if request.variable not in VARS_3D:
        raise HTTPException(
            status_code=400, detail=f"variable must be one of {VARS_3D}"
        )
    frame, data, source_label, is_difference = resolve_analysis_data(
        runtime,
        request.variable, request.date_idx, request.comparison_source
    )
    try:
        inside = all(
            point_in_region(point.lat, point.lon, request.region)
            for point in (request.p1, request.p2)
        )
    except (ValueError, TypeError) as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    if not inside:
        raise HTTPException(
            status_code=400, detail="transect point is outside region"
        )
    depths = frame["depths"]
    if not 0 <= request.depth_idx < len(depths):
        raise HTTPException(status_code=400, detail="depth_idx out of range")

    figure, title, info = make_transect_fig(
        data,
        frame["lats"],
        frame["lons"],
        depths,
        request.p1.model_dump(),
        request.p2.model_dump(),
        request.depth_idx,
        variable=request.variable,
        depth_range=tuple(request.depth_range) if request.depth_range else None,
        value_range=(
            tuple(request.value_range)
            if request.value_range and not is_difference
            else None
        ),
        is_difference=is_difference,
    )
    if source_label:
        title = f"两点垂直断面对比 · {source_label} · {title}"
        info = f"当前显示：{source_label}；{info}"
    return {"figure": figure, "title": title, "info": info}
