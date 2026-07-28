"""Pair comparison series and prepare comparison data and metrics."""

from __future__ import annotations

import numpy as np
from fastapi import HTTPException


COMPARISON_SOURCES = {"a", "b", "difference"}


def resolve_analysis_data(runtime, variable: str, date_idx: int, source: str):
    """Resolve the A, B or difference field used by profile/transect features."""
    if not runtime.is_comparison:
        frame = runtime.get_frame(date_idx)
        data = runtime.get_data(variable, frame)
        if isinstance(data, tuple):
            data = np.sqrt(data[0] ** 2 + data[1] ** 2)
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
        comparison_data(pair, variable, source, runtime.get_data),
        labels[source],
        source == "difference",
    )


def comparison_data(pair: dict, variable: str, source: str, get_data):
    """Return a full A, B, or A-B field for profiles and transects."""
    if source not in COMPARISON_SOURCES:
        raise ValueError(f"Unknown comparison source: {source}")

    def scalar(frame):
        values = get_data(variable, frame)
        if isinstance(values, tuple):
            values = np.sqrt(values[0] ** 2 + values[1] ** 2)
        return values

    values_a = scalar(pair["a"])
    if source == "a":
        return values_a
    values_b = scalar(pair["b"])
    if source == "b":
        return values_b
    if variable == "mwd":
        return (values_a - values_b + 180) % 360 - 180
    return values_a - values_b


def pair_series(frames_a: list[dict], frames_b: list[dict]) -> list[dict]:
    """Pair two series by their common dates and validate their grids."""
    by_date_a = {frame["date"]: frame for frame in frames_a}
    by_date_b = {frame["date"]: frame for frame in frames_b}
    dates = sorted(set(by_date_a) & set(by_date_b))
    if not dates:
        raise ValueError("The two series have no dates in common.")

    pairs = []
    for date in dates:
        frame_a, frame_b = by_date_a[date], by_date_b[date]
        for coord in ("lats", "lons", "depths"):
            if (
                frame_a[coord].shape != frame_b[coord].shape
                or not np.allclose(frame_a[coord], frame_b[coord], equal_nan=True)
            ):
                raise ValueError(f"Coordinate mismatch on {date}: {coord}")
        if frame_a["ss"].shape != frame_b["ss"].shape:
            raise ValueError(f"Grid shape mismatch on {date}.")
        pairs.append({"date": date, "a": frame_a, "b": frame_b})
    return pairs


def shared_ranges(pairs: list[dict], variables, get_data, finite_range) -> dict:
    """Calculate display ranges that cover both comparison series."""
    ranges = {}
    for variable in variables:
        minima, maxima = [], []
        for pair in pairs:
            for frame in (pair["a"], pair["b"]):
                values = get_data(variable, frame)
                if isinstance(values, tuple):
                    values = np.sqrt(values[0] ** 2 + values[1] ** 2)
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
    previous_pair: dict | None = None,
) -> dict:
    """Prepare layer arrays and metrics without constructing Plotly figures."""

    def scalar_layer(frame):
        values = get_data(variable, frame)
        if isinstance(values, tuple):
            values = np.sqrt(values[0] ** 2 + values[1] ** 2)
        return values if is_2d else values[depth_idx]

    layer_a = scalar_layer(pair["a"])
    layer_b = scalar_layer(pair["b"])
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
            delta = current_layer - scalar_layer(previous_pair[side])
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
