"""Dataset upload, session status, configuration and metadata routes."""

from __future__ import annotations

from fastapi import APIRouter, File, HTTPException, Request, UploadFile

from ...config import load_config, save_config
from ...core.feature_registry import public_features
from ...core.runtime import runtime
from ...core.variables import (
    VARIABLES,
    VARS_2D,
    VARS_3D,
    VARS_VECTOR,
    public_registry,
)
from .service import load_uploaded_file, load_uploaded_series


router = APIRouter(prefix="/api", tags=["dataset"])


@router.get("/status")
def get_status():
    return {"ready": runtime.ready}


@router.get("/config")
def get_config():
    return load_config()


@router.post("/config")
async def post_config(request: Request):
    config = await request.json()
    save_config(config)
    return config


@router.post("/upload")
async def upload_nc(file: UploadFile = File(...)):
    if not file.filename.lower().endswith(".nc"):
        raise HTTPException(status_code=400, detail="Only .nc files are supported.")

    try:
        runtime.init_state(await load_uploaded_file(file))
    except Exception as error:
        raise HTTPException(
            status_code=422, detail=f"Failed to load file: {error}"
        ) from error

    state = runtime.state
    return {
        "ok": True,
        "filename": file.filename,
        "shape": list(state["ss"].shape),
        "ss_min": state["ss_min"],
        "ss_max": state["ss_max"],
    }


@router.post("/upload_series")
async def upload_series(files: list[UploadFile] = File(...)):
    if not all(file.filename.lower().endswith(".nc") for file in files):
        raise HTTPException(status_code=400, detail="All files must be .nc format.")
    if len(files) < 2:
        raise HTTPException(
            status_code=400,
            detail="Please upload at least 2 files for a series.",
        )

    try:
        runtime.init_series(await load_uploaded_series(files))
    except Exception as error:
        raise HTTPException(
            status_code=422, detail=f"Failed to load series: {error}"
        ) from error

    first = runtime.state["series"][0]
    return {
        "ok": True,
        "dates": runtime.state["series_dates"],
        "shape": list(first["ss"].shape),
    }


@router.get("/dates")
def get_dates():
    if not runtime.is_series:
        return {"dates": [], "is_series": False, "is_comparison": False}
    return {
        "dates": runtime.state["series_dates"],
        "is_series": True,
        "is_comparison": runtime.is_comparison,
        "comparison_files": runtime.state.get("comparison_files", []),
    }


@router.get("/meta")
def get_meta():
    runtime.require_data()
    state = runtime.state
    depths, lats, lons = state["depths"], state["lats"], state["lons"]
    return {
        "depths": [float(depth) for depth in depths],
        "lat_range": [float(lats[0]), float(lats[-1])],
        "lon_range": [float(lons[0]), float(lons[-1])],
        "variables": {
            variable: {
                "min": state[f"{variable}_min"],
                "max": state[f"{variable}_max"],
                "available": state[f"{variable}_min"] is not None,
            }
            for variable in VARIABLES
        },
        "available_variables": sorted(
            variable
            for variable in VARIABLES
            if state[f"{variable}_min"] is not None
        ),
        "grid_shape": [int(lats.shape[0]), int(lons.shape[0])],
        "vars_3d": sorted(VARS_3D),
        "vars_2d": sorted(VARS_2D),
        "vars_vector": sorted(VARS_VECTOR),
        "variable_registry": public_registry(),
        "feature_registry": public_features(),
    }
