"""Application data session and common data-selection operations."""

from __future__ import annotations

import numpy as np
from fastapi import HTTPException
from contextvars import ContextVar

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

    def set_dataset_manifest(
        self,
        mode: str,
        dataset_a: list[dict],
        dataset_b: list[dict] | None = None,
        dates: list[str] | None = None,
        label: str | None = None,
    ):
        """Record lightweight source identity for refresh-safe UI recovery."""
        self.state["dataset_manifest"] = {
            "mode": mode,
            "datasets": {"a": dataset_a, "b": dataset_b or []},
            "dates": dates or [],
        }
        if label:
            self.state["session_label"] = label

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

    def get_scalar_data(self, variable: str, frame: dict | None = None):
        """Return the plotted scalar field while retaining vector components."""
        src = frame if frame is not None else self.state
        if variable == "uv" and src.get("current_speed") is not None:
            return src["current_speed"]
        values = self.get_data(variable, src)
        if isinstance(values, tuple):
            return np.hypot(values[0], values[1])
        return values

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
        speed = data.get("current_speed")
        if speed is None:
            speed = np.hypot(data["uo"], data["vo"])
        direction = data.get("current_direction")
        if direction is None:
            direction = (
                np.degrees(np.arctan2(data["uo"], data["vo"])) + 360.0
            ) % 360.0
            direction = np.where(
                np.isfinite(speed) & (speed > 0), direction, np.nan
            )
        self.state["current_speed"] = speed
        self.state["current_direction"] = direction
        variables = (
            "ss", "temp", "salt", "uo", "vo", "uv", "u10", "v10",
            "wind", "swh", "mwd_u", "mwd_v", "mwd",
        )
        for variable in variables:
            values = self.get_scalar_data(variable)
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
        files = [
            {"name": frame.get("filename", ""), "date": frame.get("date")}
            for frame in frames
        ]
        dates = self.state["series_dates"]
        label = (
            f"时间序列 {dates[0]} → {dates[-1]}"
            if len(dates) > 1 else files[0]["name"]
        )
        self.set_dataset_manifest(
            "series" if len(frames) > 1 else "single",
            files,
            dates=dates,
            label=label,
        )
        variables = (
            "ss", "temp", "salt", "uo", "vo", "uv", "u10", "v10",
            "wind", "swh", "mwd_u", "mwd_v", "mwd",
        )
        for variable in variables:
            minima, maxima = [], []
            for frame in frames:
                values = self.get_scalar_data(variable, frame)
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
            "ss", "temp", "salt", "uo", "vo",
            "current_speed", "current_direction",
            "u10", "v10", "swh",
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


primary_runtime = AnalysisRuntime()
region_runtime = AnalysisRuntime()
_runtime_scope = ContextVar("pisces_runtime_scope", default="explorer")


def set_runtime_scope(scope: str):
    return _runtime_scope.set(scope)


def reset_runtime_scope(token):
    _runtime_scope.reset(token)


def current_runtime_scope() -> str:
    return _runtime_scope.get()


class RuntimeProxy:
    """Route legacy runtime imports to the request-scoped workspace."""

    @property
    def target(self) -> AnalysisRuntime:
        return region_runtime if current_runtime_scope() == "region" else primary_runtime

    def __getattr__(self, name):
        return getattr(self.target, name)


runtime = RuntimeProxy()
