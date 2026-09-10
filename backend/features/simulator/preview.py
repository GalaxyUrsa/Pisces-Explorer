"""Build a lightweight, Runtime-independent Simulator background preview."""

from __future__ import annotations

import math
from pathlib import Path

import numpy as np
import plotly.graph_objects as go
import xarray as xr

from ...plotting.common import colorbar_style, figure_to_dict


MAX_PREVIEW_AXIS_POINTS = 300


def _surface_field(
    dataset: xr.Dataset,
    variable: str,
    latitude_name: str,
    longitude_name: str,
    depth_name: str,
) -> xr.DataArray:
    field = dataset[variable]
    selections = {}
    if "time" in field.dims:
        selections["time"] = 0
    if depth_name in field.dims:
        selections[depth_name] = 0
    field = field.isel(selections)
    extra_dims = [
        dim
        for dim in field.dims
        if dim not in {latitude_name, longitude_name}
    ]
    if extra_dims:
        field = field.isel({dim: 0 for dim in extra_dims})
    if latitude_name not in field.dims or longitude_name not in field.dims:
        raise ValueError(
            f"{variable} must use latitude and longitude dimensions."
        )
    return field.transpose(latitude_name, longitude_name)


def make_surface_current_preview(path: str | Path) -> dict:
    with xr.open_dataset(path, decode_cf=True) as dataset:
        required = ("longitude", "latitude", "depth", "uo", "vo")
        missing = [name for name in required if name not in dataset.variables]
        if missing:
            raise ValueError(
                "Missing required preview variables: " + ", ".join(missing)
            )
        longitude = dataset["longitude"]
        latitude = dataset["latitude"]
        depth = dataset["depth"]
        if longitude.ndim != 1 or latitude.ndim != 1 or depth.ndim != 1:
            raise ValueError(
                "Preview requires 1-D longitude, latitude and depth coordinates."
            )
        u = _surface_field(
            dataset, "uo", "latitude", "longitude", "depth"
        ).values.astype(float)
        v = _surface_field(
            dataset, "vo", "latitude", "longitude", "depth"
        ).values.astype(float)
        lons = longitude.values.astype(float)
        lats = latitude.values.astype(float)
        depth_m = float(depth.values[0])

    if u.shape != v.shape or u.shape != (len(lats), len(lons)):
        raise ValueError("Surface uo/vo grid does not match the coordinates.")
    latitude_step = max(
        1, math.ceil(len(lats) / MAX_PREVIEW_AXIS_POINTS)
    )
    longitude_step = max(
        1, math.ceil(len(lons) / MAX_PREVIEW_AXIS_POINTS)
    )
    sampled_u = u[::latitude_step, ::longitude_step]
    sampled_v = v[::latitude_step, ::longitude_step]
    sampled_lats = lats[::latitude_step]
    sampled_lons = lons[::longitude_step]
    speed = np.hypot(sampled_u, sampled_v)
    finite = np.isfinite(speed)
    if not np.any(finite):
        raise ValueError("Surface current contains no valid ocean points.")
    plotted_speed = speed.astype(object)
    plotted_speed[~finite] = None

    figure = go.Figure(
        go.Heatmap(
            z=plotted_speed,
            x=sampled_lons,
            y=sampled_lats,
            colorscale="Viridis",
            colorbar=colorbar_style("m/s"),
            hovertemplate=(
                "经度 %{x:.3f}°<br>纬度 %{y:.3f}°<br>"
                "表层流速 %{z:.3f} m/s<extra></extra>"
            ),
            zsmooth=False,
        )
    )
    figure.update_layout(
        paper_bgcolor="#ffffff",
        plot_bgcolor="#f8fafc",
        margin={"l": 58, "r": 72, "t": 42, "b": 52},
        title={
            "text": f"表层合成流速 · 深度 {depth_m:g} m",
            "font": {"size": 14, "color": "#334155"},
            "x": 0.02,
        },
        xaxis={
            "title": "经度",
            "range": [float(np.min(lons)), float(np.max(lons))],
        },
        yaxis={
            "title": "纬度",
            "range": [float(np.min(lats)), float(np.max(lats))],
        },
        hovermode="closest",
        clickmode="event",
        dragmode="pan",
        uirevision="simulator-background",
    )
    return {
        "figure": figure_to_dict(figure),
        "lon_range": [float(np.min(lons)), float(np.max(lons))],
        "lat_range": [float(np.min(lats)), float(np.max(lats))],
        "depth_m": depth_m,
        "variable": "surface_current_speed",
        "grid_shape": [len(sampled_lats), len(sampled_lons)],
    }
