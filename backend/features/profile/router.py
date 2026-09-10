"""Vertical point-profile route."""

from fastapi import APIRouter, HTTPException

from ...core.runtime import runtime
from ...core.spatial import point_in_region
from ...core.variables import VARS_3D
from ..comparison.service import resolve_analysis_data
from .figure import make_profile_fig
from .schema import ProfileRequest


router = APIRouter(prefix="/api", tags=["profile"])


@router.post("/profile")
def get_profile(request: ProfileRequest):
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
        inside = point_in_region(request.lat, request.lon, request.region)
    except (ValueError, TypeError) as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    if not inside:
        raise HTTPException(status_code=400, detail="point is outside region")
    depths = frame["depths"]
    if not 0 <= request.depth_idx < len(depths):
        raise HTTPException(status_code=400, detail="depth_idx out of range")

    figure, title, info = make_profile_fig(
        data,
        frame["lats"],
        frame["lons"],
        depths,
        request.lat,
        request.lon,
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
        title = f"单点垂直剖面对比 · {source_label} · {title}"
        info = f"当前显示：{source_label}；{info}"
    return {"figure": figure, "title": title, "info": info}
