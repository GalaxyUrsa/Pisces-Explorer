"""Application data session and common data-selection operations."""

from __future__ import annotations

import numpy as np
from fastapi import HTTPException

from ..data import load_sound_speed
from .session_store import SessionStore


class AnalysisRuntime:
    """Own the current in-memory dataset independently from HTTP routes."""

    def __init__(self):
        self.state = SessionStore()

    @property
    def ready(self) -> bool:
        return self.state.ready

    @property
    def is_series(self) -> bool:
        return self.state.is_series

    @property
    def is_comparison(self) -> bool:
        return self.state.is_comparison

    def require_data(self):
        if not self.ready:
            raise HTTPException(
                status_code=503,
                detail="No data loaded. Please upload a .nc file first.",
            )

    def get_data(self, variable: str, frame: dict | None = None):
        src = frame if frame is not None else self.state
        if variable == "uv":
            return src["uo"], src["vo"]
        if variable == "wind":
            return src["u10"], src["v10"]
        if variable == "mwd":
            u, v = src["mwd_u"], src["mwd_v"]
            return (90 - np.degrees(np.arctan2(v, u))) % 360
        return src[variable]

    @staticmethod
    def finite_range(data):
        arr = np.asarray(data)
        finite = arr[np.isfinite(arr)]
        if finite.size == 0:
            return None, None
        return float(finite.min()), float(finite.max())

    def init_state(self, data: dict):
        self.state.clear_mode_state()
        for key in (
            "ss", "temp", "salt", "uo", "vo", "u10", "v10", "swh",
            "mwd_u", "mwd_v", "lats", "lons", "depths",
        ):
            self.state[key] = data[key]
        variables = (
            "ss", "temp", "salt", "uo", "vo", "uv", "u10", "v10",
            "wind", "swh", "mwd_u", "mwd_v", "mwd",
        )
        for variable in variables:
            values = self.get_data(variable)
            if isinstance(values, tuple):
                values = np.sqrt(values[0] ** 2 + values[1] ** 2)
            vmin, vmax = self.finite_range(values)
            self.state[f"{variable}_min"] = vmin
            self.state[f"{variable}_max"] = vmax
        for key in (
            "volume_ss", "volume_temp", "volume_salt",
            "volume_uo", "volume_vo", "volume_uv",
        ):
            self.state.pop(key, None)

    def init_series(self, frames: list[dict]):
        self.init_state(frames[0])
        self.state["series"] = frames
        self.state["series_dates"] = [frame["date"] for frame in frames]
        variables = (
            "ss", "temp", "salt", "uo", "vo", "uv", "u10", "v10",
            "wind", "swh", "mwd_u", "mwd_v", "mwd",
        )
        for variable in variables:
            minima, maxima = [], []
            for frame in frames:
                values = self.get_data(variable, frame)
                if isinstance(values, tuple):
                    values = np.sqrt(values[0] ** 2 + values[1] ** 2)
                vmin, vmax = self.finite_range(values)
                if vmin is not None:
                    minima.append(vmin)
                    maxima.append(vmax)
            self.state[f"{variable}_min"] = min(minima) if minima else None
            self.state[f"{variable}_max"] = max(maxima) if maxima else None

    def get_frame(self, date_idx: int) -> dict:
        if self.is_series:
            series = self.state["series"]
            index = max(0, min(date_idx, len(series) - 1))
            return series[index]
        keys = (
            "ss", "temp", "salt", "uo", "vo", "u10", "v10", "swh",
            "mwd_u", "mwd_v", "lats", "lons", "depths",
        )
        return {key: self.state[key] for key in keys}

    def get_comparison_frame(self, date_idx: int) -> dict:
        if not self.is_comparison:
            raise HTTPException(
                status_code=400, detail="No comparison series loaded."
            )
        series = self.state["comparison_series"]
        index = max(0, min(date_idx, len(series) - 1))
        return series[index]

    def init_from_directory(self, nc_dir: str, date_str: str):
        self.init_state(load_sound_speed(nc_dir, date_str))


runtime = AnalysisRuntime()
