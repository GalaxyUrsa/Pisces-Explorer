"""Comparison upload and horizontal comparison routes."""

from __future__ import annotations

import json
from typing import Annotated, Optional

import numpy as np
from fastapi import APIRouter, File, HTTPException, Query, UploadFile

from ...core.runtime import runtime
from ...core.variables import VARIABLES, VARS_2D, VARS_3D
from ..volume.figure import make_volume_fig
from ..dataset.service import load_uploaded_series
from .figure import build_layer_comparison
from .service import (
    COMPARISON_SOURCES,
    comparison_data,
    pair_series,
    shared_ranges,
    unchanged_dates,
)


router = APIRouter(prefix="/api", tags=["comparison"])


@router.post("/upload_comparison")
async def upload_comparison(
    files_a: list[UploadFile] = File(...),
    files_b: list[UploadFile] = File(...),
):
    if len(files_a) < 2 or len(files_b) < 2:
        raise HTTPException(
            status_code=400,
            detail="Each series must contain at least 2 files.",
        )
    if not all(
        upload.filename.lower().endswith(".nc")
        for upload in files_a + files_b
    ):
        raise HTTPException(status_code=400, detail="All files must be .nc format.")

    try:
        frames_a = await load_uploaded_series(files_a)
        frames_b = await load_uploaded_series(files_b)
        pairs = pair_series(frames_a, frames_b)
        runtime.init_series([pair["a"] for pair in pairs])
        state = runtime.state
        state["comparison_series"] = pairs
        state["comparison_labels"] = ["序列 A", "序列 B"]
        state["comparison_files"] = [
            {
                "date": pair["date"],
                "a": pair["a"].get("filename", ""),
                "b": pair["b"].get("filename", ""),
            }
            for pair in pairs
        ]
        ranges = shared_ranges(
            pairs, VARIABLES, runtime.get_data, runtime.finite_range
        )
        for variable, (vmin, vmax) in ranges.items():
            state[f"{variable}_min"] = vmin
            state[f"{variable}_max"] = vmax
    except Exception as error:
        raise HTTPException(
            status_code=422, detail=f"Failed to load comparison: {error}"
        ) from error
    return {
        "ok": True,
        "dates": [pair["date"] for pair in pairs],
        "shape": list(pairs[0]["a"]["ss"].shape),
        "dropped_a": len(frames_a) - len(pairs),
        "dropped_b": len(frames_b) - len(pairs),
        "unchanged_a_dates": unchanged_dates(pairs, "a"),
        "unchanged_b_dates": unchanged_dates(pairs, "b"),
    }


@router.get("/comparison/layer/{depth_idx}")
def get_comparison_layer(
    depth_idx: int,
    variable: Annotated[str, Query()] = "ss",
    points: Annotated[Optional[str], Query()] = None,
    cmin: Annotated[Optional[float], Query()] = None,
    cmax: Annotated[Optional[float], Query()] = None,
    colorscale: Annotated[Optional[str], Query()] = None,
    date_idx: Annotated[int, Query()] = 0,
):
    if variable not in VARIABLES:
        raise HTTPException(
            status_code=400, detail=f"variable must be one of {VARIABLES}"
        )
    if not runtime.is_comparison:
        raise HTTPException(
            status_code=400, detail="No comparison series loaded."
        )

    series = runtime.state["comparison_series"]
    safe_index = max(0, min(date_idx, len(series) - 1))
    pair = series[safe_index]
    previous_pair = series[safe_index - 1] if safe_index > 0 else None
    is_2d = variable in VARS_2D
    if not is_2d and not 0 <= depth_idx < len(pair["a"]["depths"]):
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
    return build_layer_comparison(
        pair,
        variable=variable,
        depth_idx=depth_idx,
        is_2d=is_2d,
        points=selected_points,
        get_data=runtime.get_data,
        vmin=cmin if cmin is not None else state.get(f"{variable}_min"),
        vmax=cmax if cmax is not None else state.get(f"{variable}_max"),
        colorscale=colorscale,
        previous_pair=previous_pair,
    )


@router.get("/comparison/volume")
def get_comparison_volume(
    variable: Annotated[str, Query()] = "ss",
    comparison_source: Annotated[str, Query()] = "a",
    cmin: Annotated[Optional[float], Query()] = None,
    cmax: Annotated[Optional[float], Query()] = None,
    colorscale: Annotated[Optional[str], Query()] = None,
    color_min: Annotated[Optional[str], Query()] = None,
    color_max: Annotated[Optional[str], Query()] = None,
    layers: Annotated[Optional[str], Query()] = None,
    date_idx: Annotated[int, Query()] = 0,
):
    """Return a 3D A, B, or A-minus-B field for one paired date."""
    if variable not in VARS_3D:
        raise HTTPException(
            status_code=400, detail=f"variable must be one of {VARS_3D}"
        )
    if comparison_source not in COMPARISON_SOURCES:
        raise HTTPException(
            status_code=400,
            detail=f"comparison_source must be one of {COMPARISON_SOURCES}",
        )
    if not runtime.is_comparison:
        raise HTTPException(
            status_code=400, detail="No comparison series loaded."
        )

    pair = runtime.get_comparison_frame(date_idx)
    data = comparison_data(
        pair, variable, comparison_source, runtime.get_data
    )
    depth_indices = None
    if layers is not None:
        try:
            depth_indices = [
                int(index) for index in layers.split(",") if index.strip()
            ]
        except ValueError as error:
            raise HTTPException(
                status_code=400, detail="Invalid layers list"
            ) from error

    custom = [color_min, color_max] if color_min and color_max else None
    source_labels = {
        "a": "序列 A",
        "b": "序列 B",
        "difference": "差值 A−B",
    }
    if comparison_source == "difference":
        finite = data[np.isfinite(data)]
        limit = float(np.max(np.abs(finite))) if finite.size else 1.0
        if limit == 0:
            limit = 1.0
        cmin, cmax = -limit, limit
        colorscale = "RdBu_r"
        custom = None

    frame = pair["a"]
    return {
        "date": pair["date"],
        "source": comparison_source,
        "title": f"三维场 · {source_labels[comparison_source]} · {pair['date']}",
        "figure": make_volume_fig(
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
        ),
    }
