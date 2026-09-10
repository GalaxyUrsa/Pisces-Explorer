"""Pair comparison series and prepare comparison data and metrics."""

from __future__ import annotations

import re

import numpy as np
from fastapi import HTTPException


COMPARISON_SOURCES = {"a", "b", "difference"}


def _scalar_data(variable, frame, get_data, get_scalar_data=None):
    if get_scalar_data is not None:
        return get_scalar_data(variable, frame)
    values = get_data(variable, frame)
    if isinstance(values, tuple):
        values = np.hypot(values[0], values[1])
    return values


def single_comparison_label(filename_a: str, filename_b: str) -> str:
    """Return a display label for a one-file A/B comparison."""
    date_a = re.search(r"(\d{8})", filename_a)
    date_b = re.search(r"(\d{8})", filename_b)
    if date_a and date_b:
        if date_a.group(1) == date_b.group(1):
            return date_a.group(1)
        return f"{date_a.group(1)} vs {date_b.group(1)}"
    if date_a:
        return date_a.group(1)
    if date_b:
        return date_b.group(1)
    return "单日"


def resolve_analysis_data(runtime, variable: str, date_idx: int, source: str):
    """Resolve the A, B or difference field used by profile/transect features."""
    if not runtime.is_comparison:
        frame = runtime.get_frame(date_idx)
        data = runtime.get_scalar_data(variable, frame)
        return frame, data, None, False

    if source not in COMPARISON_SOURCES:
        raise HTTPException(
            status_code=400,
            detail=f"comparison_source must be one of {COMPARISON_SOURCES}",
        )
    pair = runtime.get_comparison_frame(date_idx)
    labels = {
        "a": "序列 A",
        "b": "序列 B",
        "difference": "差值 A − B",
    }
    return (
        pair["a"],
        comparison_data(
            pair,
            variable,
            source,
            runtime.get_data,
            runtime.get_scalar_data,
        ),
        labels[source],
        source == "difference",
    )


def comparison_data(
    pair: dict,
    variable: str,
    source: str,
    get_data,
    get_scalar_data=None,
):
    """Return a full A, B, or A-B field for profiles and transects."""
    if source not in COMPARISON_SOURCES:
        raise ValueError(f"Unknown comparison source: {source}")

    def scalar(frame):
        return _scalar_data(
            variable, frame, get_data, get_scalar_data
        )

    values_a = scalar(pair["a"])
    if source == "a":
        return values_a
    values_b = scalar(pair["b"])
    if source == "b":
        return values_b
    if variable == "mwd":
        return (values_a - values_b + 180) % 360 - 180
    return values_a - values_b


def pair_frames(frame_a: dict, frame_b: dict, label: str) -> dict:
    """Validate and pair two frames under one display label."""
    for coord in ("lats", "lons", "depths"):
        if (
            frame_a[coord].shape != frame_b[coord].shape
            or not np.allclose(frame_a[coord], frame_b[coord], equal_nan=True)
        ):
            raise ValueError(f"Coordinate mismatch on {label}: {coord}")
    if frame_a["ss"].shape != frame_b["ss"].shape:
        raise ValueError(f"Grid shape mismatch on {label}.")

    def source_date(frame: dict) -> str:
        filename_date = re.search(r"(\d{8})", frame.get("filename", ""))
        return filename_date.group(1) if filename_date else frame.get("date", label)

    return {
        "date": label,
        "source_dates": {
            "a": source_date(frame_a),
            "b": source_date(frame_b),
        },
        "a": frame_a,
        "b": frame_b,
    }


def pair_series(frames_a: list[dict], frames_b: list[dict]) -> list[dict]:
    """Pair two series by their common dates and validate their grids."""
    by_date_a = {frame["date"]: frame for frame in frames_a}
    by_date_b = {frame["date"]: frame for frame in frames_b}
    dates = sorted(set(by_date_a) & set(by_date_b))
    if not dates:
        raise ValueError("The two series have no dates in common.")
    return [
        pair_frames(by_date_a[date], by_date_b[date], date)
        for date in dates
    ]


def shared_ranges(
    pairs: list[dict],
    variables,
    get_data,
    finite_range,
    get_scalar_data=None,
) -> dict:
    """Calculate display ranges that cover both comparison series."""
    ranges = {}
    for variable in variables:
        minima, maxima = [], []
        for pair in pairs:
            for frame in (pair["a"], pair["b"]):
                values = _scalar_data(
                    variable, frame, get_data, get_scalar_data
                )
                vmin, vmax = finite_range(values)
                if vmin is not None:
                    minima.append(vmin)
                    maxima.append(vmax)
        ranges[variable] = (
            min(minima) if minima else None,
            max(maxima) if maxima else None,
        )
    return ranges


def unchanged_dates(pairs: list[dict], side: str) -> list[str]:
    """Return dates whose primary fields equal the preceding frame."""
    unchanged = []
    for previous, current in zip(pairs, pairs[1:]):
        variables = (
            set(previous[side])
            & set(current[side])
            - {"date", "filename", "lats", "lons", "depths"}
        )
        same = True
        for variable in variables:
            previous_values = np.asarray(previous[side][variable])
            current_values = np.asarray(current[side][variable])
            if (
                np.issubdtype(previous_values.dtype, np.number)
                and np.issubdtype(current_values.dtype, np.number)
            ):
                equal = np.array_equal(
                    previous_values, current_values, equal_nan=True
                )
            else:
                equal = np.array_equal(previous_values, current_values)
            if not equal:
                same = False
                break
        if same:
            unchanged.append(current["date"])
    return unchanged


def prepare_layer_comparison(
    pair: dict,
    *,
    variable: str,
    depth_idx: int,
    is_2d: bool,
    get_data,
    get_scalar_data=None,
    previous_pair: dict | None = None,
    layer_values: dict | None = None,
    previous_layer_values: dict | None = None,
) -> dict:
    """Prepare layer arrays and metrics without constructing Plotly figures."""

    def scalar_layer(frame):
        values = _scalar_data(
            variable, frame, get_data, get_scalar_data
        )
        return values if is_2d else values[depth_idx]

    layer_a = layer_values["a"] if layer_values is not None else scalar_layer(pair["a"])
    layer_b = layer_values["b"] if layer_values is not None else scalar_layer(pair["b"])
    difference = (
        (layer_a - layer_b + 180) % 360 - 180
        if variable == "mwd"
        else layer_a - layer_b
    )
    finite_difference = difference[np.isfinite(difference)]
    difference_limit = (
        float(np.max(np.abs(finite_difference)))
        if finite_difference.size
        else 1.0
    )
    if difference_limit == 0:
        difference_limit = 1.0

    def statistics(values):
        finite = values[np.isfinite(values)]
        if not finite.size:
            return {"min": None, "max": None, "mean": None}
        return {
            "min": float(finite.min()),
            "max": float(finite.max()),
            "mean": float(finite.mean()),
        }

    change = {"a": None, "b": None}
    if previous_pair is not None:
        for side, current_layer in (("a", layer_a), ("b", layer_b)):
            previous_layer = (
                previous_layer_values[side]
                if previous_layer_values is not None
                else scalar_layer(previous_pair[side])
            )
            delta = current_layer - previous_layer
            finite_delta = delta[np.isfinite(delta)]
            change[side] = (
                float(np.max(np.abs(finite_delta)))
                if finite_delta.size
                else None
            )

    return {
        "layer_a": layer_a,
        "layer_b": layer_b,
        "difference": difference,
        "difference_limit": difference_limit,
        "metrics": {
            "mae": (
                float(np.mean(np.abs(finite_difference)))
                if finite_difference.size
                else None
            ),
            "rmse": (
                float(np.sqrt(np.mean(finite_difference ** 2)))
                if finite_difference.size
                else None
            ),
        },
        "stats": {
            "a": statistics(layer_a),
            "b": statistics(layer_b),
        },
        "change_from_previous": change,
    }
