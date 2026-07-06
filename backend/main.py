"""
FastAPI backend entry point.
"""

from __future__ import annotations

import asyncio
import json
import sys
import tempfile
import os
from typing import Annotated, Optional

from fastapi import FastAPI, HTTPException, Query, UploadFile, File, Request
from fastapi.responses import FileResponse, Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from .data import load_sound_speed, load_from_path
from .figures import make_layer_fig, make_profile_fig, make_transect_fig, make_volume_fig, VAR_META
from .config import load_config, save_config

# ---------------------------------------------------------------------------
# App state
# ---------------------------------------------------------------------------

_state: dict = {}

VARS_3D     = {"ss", "temp", "salt", "uo", "vo", "uv"}
VARS_2D     = {"u10", "v10", "wind", "swh", "mwd_u", "mwd_v", "mwd"}
VARS_VECTOR = {"uv", "wind", "mwd"}
VARIABLES   = VARS_3D | VARS_2D


def _is_ready():
    return "ss" in _state


def _require_data():
    if not _is_ready():
        raise HTTPException(status_code=503, detail="No data loaded. Please upload a .nc file first.")


def _get_data(variable: str, frame: dict = None):
    """Return data for the requested variable from frame or global state.
    Vector variables return (u, v) tuple; others return a single array."""
    src = frame if frame is not None else _state
    if variable == "uv":
        return src["uo"], src["vo"]
    if variable == "wind":
        return src["u10"], src["v10"]
    if variable == "mwd":
        return src["mwd_u"], src["mwd_v"]
    return src[variable]


def _init_state(data: dict):
    for key in ("ss", "temp", "salt", "uo", "vo", "u10", "v10", "swh", "mwd_u", "mwd_v",
                "lats", "lons", "depths"):
        _state[key] = data[key]
    for var in ("ss", "temp", "salt", "uo", "vo", "uv", "u10", "v10", "wind", "swh", "mwd_u", "mwd_v", "mwd"):
        meta = VAR_META.get(var, {})
        _state[f"{var}_min"] = float(meta.get("vmin", 0))
        _state[f"{var}_max"] = float(meta.get("vmax", 1))
    for key in ("volume_ss", "volume_temp", "volume_salt", "volume_uo", "volume_vo", "volume_uv"):
        _state.pop(key, None)
    print("Data loaded. Volume figures will be computed on first request.")


def _init_series(frames: list[dict]):
    """Store a list of frame dicts; frame 0 becomes the active single-frame state too."""
    _state["series"] = frames
    _state["series_dates"] = [f["date"] for f in frames]
    _init_state(frames[0])


def _is_series() -> bool:
    return "series" in _state and len(_state["series"]) > 1


def _get_frame(date_idx: int) -> dict:
    """Return a specific frame from the series, or the single-frame state as a dict."""
    if _is_series():
        series = _state["series"]
        idx = max(0, min(date_idx, len(series) - 1))
        return series[idx]
    return {k: _state[k] for k in ("ss", "temp", "salt", "uo", "vo",
                                    "u10", "v10", "swh", "mwd_u", "mwd_v",
                                    "lats", "lons", "depths")}


def _ensure_volume(variable: str):
    key = f"volume_{variable}"
    if key not in _state:
        data = _get_data(variable)
        vmin = _state.get(f"{variable}_min")
        vmax = _state.get(f"{variable}_max")
        if isinstance(data, tuple):
            import numpy as np
            u, v = data
            mag = np.sqrt(u**2 + v**2)
            _state[key] = make_volume_fig(mag, _state["lats"], _state["lons"],
                                          _state["depths"], variable=variable,
                                          vmin=vmin, vmax=vmax)
        else:
            _state[key] = make_volume_fig(data, _state["lats"], _state["lons"],
                                          _state["depths"], variable=variable,
                                          vmin=vmin, vmax=vmax)
    return _state[key]


def _var_range(variable: str):
    return _state.get(f"{variable}_min"), _state.get(f"{variable}_max")


def init_data(nc_dir: str, date_str: str):
    data = load_sound_speed(nc_dir, date_str)
    _init_state(data)


# ---------------------------------------------------------------------------
# FastAPI app
# ---------------------------------------------------------------------------

app = FastAPI(title="Ocean Sound Speed API")


# ---------------------------------------------------------------------------
# Request / response models
# ---------------------------------------------------------------------------

class Point(BaseModel):
    lat: float
    lon: float


class ProfileRequest(BaseModel):
    lat: float
    lon: float
    depth_idx: int
    variable: str = "ss"
    depth_range: Optional[list] = None
    value_range: Optional[list] = None
    date_idx: int = 0


class TransectRequest(BaseModel):
    p1: Point
    p2: Point
    depth_idx: int
    variable: str = "ss"
    depth_range: Optional[list] = None
    value_range: Optional[list] = None
    date_idx: int = 0


# ---------------------------------------------------------------------------
# API routes
# ---------------------------------------------------------------------------

@app.get("/api/status")
def get_status():
    return {"ready": _is_ready()}


@app.get("/api/config")
def get_config():
    return load_config()


@app.post("/api/config")
async def post_config(request: Request):
    cfg = await request.json()
    save_config(cfg)
    return cfg


@app.post("/api/upload")
async def upload_nc(file: UploadFile = File(...)):
    if not file.filename.endswith(".nc"):
        raise HTTPException(status_code=400, detail="Only .nc files are supported.")

    with tempfile.NamedTemporaryFile(delete=False, suffix=".nc") as tmp:
        tmp.write(await file.read())
        tmp_path = tmp.name

    try:
        data = load_from_path(tmp_path)
        _init_state(data)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Failed to load file: {e}")
    finally:
        os.unlink(tmp_path)

    return {
        "ok": True,
        "filename": file.filename,
        "shape": list(_state["ss"].shape),
        "ss_min": _state["ss_min"],
        "ss_max": _state["ss_max"],
    }


@app.post("/api/upload_series")
async def upload_series(files: list[UploadFile] = File(...)):
    if not all(f.filename.endswith(".nc") for f in files):
        raise HTTPException(status_code=400, detail="All files must be .nc format.")
    if len(files) < 2:
        raise HTTPException(status_code=400, detail="Please upload at least 2 files for a series.")

    tmp_paths = []
    try:
        for f in files:
            with tempfile.NamedTemporaryFile(delete=False, suffix=".nc") as tmp:
                tmp.write(await f.read())
                tmp_paths.append((tmp.name, f.filename))
        tmp_paths.sort(key=lambda x: x[1])
        from .data import load_series
        frames = load_series(tmp_paths)
        _init_series(frames)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Failed to load series: {e}")
    finally:
        for p, _ in tmp_paths:
            try:
                os.unlink(p)
            except OSError:
                pass

    f0 = _state["series"][0]
    return {
        "ok": True,
        "dates": _state["series_dates"],
        "shape": list(f0["ss"].shape),
    }

@app.get("/api/dates")
def get_dates():
    if not _is_series():
        return {"dates": [], "is_series": False}
    return {"dates": _state["series_dates"], "is_series": True}


@app.get("/api/meta")
def get_meta():
    _require_data()
    depths = _state["depths"]
    lats   = _state["lats"]
    lons   = _state["lons"]
    return {
        "depths":      [float(d) for d in depths],
        "lat_range":   [float(lats[0]), float(lats[-1])],
        "lon_range":   [float(lons[0]), float(lons[-1])],
        "variables": {
            v: {"min": _state[f"{v}_min"], "max": _state[f"{v}_max"]}
            for v in VARIABLES
        },
        "grid_shape":  [int(lats.shape[0]), int(lons.shape[0])],
        "vars_3d":     sorted(VARS_3D),
        "vars_2d":     sorted(VARS_2D),
        "vars_vector": sorted(VARS_VECTOR),
    }


@app.get("/api/volume")
def get_volume(variable: Annotated[str, Query()] = "ss",
               cmin: Annotated[Optional[float], Query()] = None,
               cmax: Annotated[Optional[float], Query()] = None,
               colorscale: Annotated[Optional[str], Query()] = None,
               color_min: Annotated[Optional[str], Query()] = None,
               color_max: Annotated[Optional[str], Query()] = None,
               date_idx: Annotated[int, Query()] = 0):
    _require_data()
    if variable not in VARS_3D:
        raise HTTPException(status_code=400, detail=f"variable must be one of {VARS_3D}")
    frame  = _get_frame(date_idx)
    data   = _get_data(variable, frame)
    if isinstance(data, tuple):
        import numpy as np
        u, v = data
        data = np.sqrt(u**2 + v**2)
    custom = [color_min, color_max] if (color_min and color_max) else None
    if not _is_series() and cmin is None and cmax is None and colorscale is None and custom is None:
        return _ensure_volume(variable)
    return make_volume_fig(data, frame["lats"], frame["lons"],
                           frame["depths"], variable=variable,
                           vmin=cmin, vmax=cmax,
                           colorscale=None if custom else colorscale,
                           colorscale_custom=custom)


@app.get("/api/layer/{depth_idx}")
def get_layer(depth_idx: int,
              variable: Annotated[str, Query()] = "ss",
              points:   Annotated[Optional[str], Query()] = None,
              cmin:     Annotated[Optional[float], Query()] = None,
              cmax:     Annotated[Optional[float], Query()] = None,
              colorscale: Annotated[Optional[str], Query()] = None,
              color_min: Annotated[Optional[str], Query()] = None,
              color_max: Annotated[Optional[str], Query()] = None,
              date_idx: Annotated[int, Query()] = 0,
              step:     Annotated[int, Query()] = 20):
    _require_data()
    if variable not in VARIABLES:
        raise HTTPException(status_code=400, detail=f"variable must be one of {VARIABLES}")
    frame  = _get_frame(date_idx)
    depths = frame["depths"]

    is_2d = variable in VARS_2D
    if not is_2d and (depth_idx < 0 or depth_idx >= len(depths)):
        raise HTTPException(status_code=400, detail="depth_idx out of range")

    pts = []
    if points:
        try:
            pts = json.loads(points)
        except json.JSONDecodeError:
            raise HTTPException(status_code=400, detail="Invalid points JSON")

    vmin   = cmin if cmin is not None else _state.get(f"{variable}_min")
    vmax   = cmax if cmax is not None else _state.get(f"{variable}_max")
    data   = _get_data(variable, frame)
    custom = [color_min, color_max] if (color_min and color_max) else None

    # For 2D variables, extract the surface array (or u/v tuple)
    if is_2d:
        if isinstance(data, tuple):
            u_surf, v_surf = data
        else:
            u_surf, v_surf = data, None
        actual_depth_idx = 0
    else:
        if isinstance(data, tuple):
            u_surf = data[0][depth_idx]
            v_surf = data[1][depth_idx]
        else:
            u_surf = data
            v_surf = None
        actual_depth_idx = depth_idx

    quiver_uv = (u_surf, v_surf, step) if (variable in VARS_VECTOR and v_surf is not None) else None

    # For vector variables: mwd shows direction angle as heatmap; others show magnitude
    if variable == "mwd" and v_surf is not None:
        import numpy as np
        heatmap_data = (np.degrees(np.arctan2(u_surf, v_surf)) + 360) % 360
    elif variable in VARS_VECTOR and v_surf is not None:
        import numpy as np
        heatmap_data = np.sqrt(u_surf**2 + v_surf**2)
    elif is_2d:
        heatmap_data = u_surf
    else:
        heatmap_data = data

    fig = make_layer_fig(
        heatmap_data,
        frame["lats"], frame["lons"],
        depths, actual_depth_idx, pts,
        variable=variable,
        vmin=vmin, vmax=vmax,
        colorscale=None if custom else colorscale,
        colorscale_custom=custom,
        quiver_uv=quiver_uv,
        is_2d=is_2d,
    )

    var_labels = {
        "ss": "声速", "temp": "温度", "salt": "盐度",
        "uo": "东向流速", "vo": "北向流速", "uv": "流速",
        "u10": "风速u", "v10": "风速v", "wind": "风速",
        "swh": "有效波高",
        "mwd_u": "波向u", "mwd_v": "波向v", "mwd": "波向",
    }
    date_label = f"  [{frame['date']}]" if _is_series() else ""
    if is_2d:
        title = f"{var_labels.get(variable, variable)}  （表面层）{date_label}"
    else:
        depth_val = float(depths[depth_idx])
        n_depth   = len(depths)
        title = f"{var_labels.get(variable, variable)}  {depth_val:.1f} m（第 {depth_idx + 1}/{n_depth} 层）{date_label}"
    return {"figure": fig, "title": title}


@app.post("/api/profile")
def get_profile(req: ProfileRequest):
    _require_data()
    if req.variable not in VARS_3D:
        raise HTTPException(status_code=400, detail=f"variable must be one of {VARS_3D}")
    frame  = _get_frame(req.date_idx)
    depths = frame["depths"]
    if req.depth_idx < 0 or req.depth_idx >= len(depths):
        raise HTTPException(status_code=400, detail="depth_idx out of range")

    data = _get_data(req.variable, frame)
    if isinstance(data, tuple):
        import numpy as np
        u, v = data
        data = np.sqrt(u**2 + v**2)
    fig, title, info = make_profile_fig(
        data, frame["lats"], frame["lons"], depths,
        req.lat, req.lon, req.depth_idx,
        variable=req.variable,
        depth_range=tuple(req.depth_range) if req.depth_range else None,
        value_range=tuple(req.value_range) if req.value_range else None,
    )
    return {"figure": fig, "title": title, "info": info}


@app.post("/api/transect")
def get_transect(req: TransectRequest):
    _require_data()
    if req.variable not in VARS_3D:
        raise HTTPException(status_code=400, detail=f"variable must be one of {VARS_3D}")
    frame  = _get_frame(req.date_idx)
    depths = frame["depths"]
    if req.depth_idx < 0 or req.depth_idx >= len(depths):
        raise HTTPException(status_code=400, detail="depth_idx out of range")

    data = _get_data(req.variable, frame)
    if isinstance(data, tuple):
        import numpy as np
        u, v = data
        data = np.sqrt(u**2 + v**2)
    fig, title, info = make_transect_fig(
        data, frame["lats"], frame["lons"], depths,
        req.p1.model_dump(), req.p2.model_dump(), req.depth_idx,
        variable=req.variable,
        depth_range=tuple(req.depth_range) if req.depth_range else None,
        value_range=tuple(req.value_range) if req.value_range else None,
    )
    return {"figure": fig, "title": title, "info": info}


# ---------------------------------------------------------------------------
# Static files + index
# ---------------------------------------------------------------------------

def _get_frontend_dir():
    if getattr(sys, 'frozen', False):
        return os.path.join(sys._MEIPASS, "frontend")
    return os.path.join(os.path.dirname(__file__), "..", "frontend")


_FRONTEND = _get_frontend_dir()

app.mount("/static", StaticFiles(directory=_FRONTEND), name="static")


@app.middleware("http")
async def no_cache_static(request: Request, call_next):
    response = await call_next(request)
    if request.url.path.startswith("/static/"):
        response.headers["Cache-Control"] = "no-store"
    return response


@app.get("/")
def index():
    return FileResponse(os.path.join(_FRONTEND, "index.html"),
                        headers={"Cache-Control": "no-store"})
