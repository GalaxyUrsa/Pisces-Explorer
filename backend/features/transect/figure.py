"""Build a two-point vertical transect figure."""

from __future__ import annotations

import numpy as np
import plotly.graph_objects as go

from ...data import nearest_idx
from ...plotting.common import (
    colorbar_style,
    figure_to_dict,
    panel_layout,
    variable_meta,
)


def make_transect_fig(
    data,
    lats,
    lons,
    depths,
    p1: dict,
    p2: dict,
    depth_idx: int,
    variable: str = "ss",
    depth_range: tuple = None,
    value_range: tuple = None,
    is_difference: bool = False,
) -> tuple[dict, str, str]:
    meta = variable_meta(variable)
    display_label = (
        f"{meta['label']}差值（A − B）" if is_difference else meta["label"]
    )
    vmin = float(np.nanmin(data))
    vmax = float(np.nanmax(data))
    selected_depth = float(depths[depth_idx])

    point_count = 200
    latitude_line = np.linspace(p1["lat"], p2["lat"], point_count)
    longitude_line = np.linspace(p1["lon"], p2["lon"], point_count)
    section = np.full((len(depths), point_count), np.nan)
    for index in range(point_count):
        latitude_index = nearest_idx(lats, latitude_line[index])
        longitude_index = nearest_idx(lons, longitude_line[index])
        section[:, index] = data[:, latitude_index, longitude_index]

    earth_radius = 6371.0
    latitude_delta = np.radians(latitude_line - latitude_line[0])
    longitude_delta = np.radians(longitude_line - longitude_line[0])
    latitude_middle = np.radians(
        (latitude_line[0] + latitude_line[-1]) / 2
    )
    distance_km = np.sqrt(
        (latitude_delta * earth_radius) ** 2
        + (
            longitude_delta
            * earth_radius
            * np.cos(latitude_middle)
        )
        ** 2
    )

    if is_difference:
        limit = max(abs(vmin), abs(vmax)) or 1.0
        zmin, zmax = -limit, limit
    elif value_range:
        zmin, zmax = value_range
    else:
        zmin, zmax = vmin, vmax

    figure = go.Figure()
    figure.add_trace(
        go.Contour(
            x=distance_km,
            y=depths,
            z=section,
            colorscale="RdBu_r" if is_difference else meta["colorscale"],
            zmin=zmin,
            zmax=zmax,
            ncontours=30,
            contours_coloring="fill",
            colorbar=colorbar_style(meta["unit"], length=1.0),
            hovertemplate=(
                "距离: %{x:.1f} km<br>深度: %{y:.1f} m<br>"
                f"{display_label}: %{{z:.2f}} {meta['unit']}"
                "<extra></extra>"
            ),
        )
    )
    figure.add_hline(
        y=selected_depth,
        line={"color": "#ff7b72", "width": 1.5, "dash": "dot"},
        annotation_text=f"{selected_depth:.1f} m",
        annotation_font_color="#ff7b72",
    )

    yaxis = {
        "title": "深度 (m)",
        "gridcolor": "#e2e8f0",
        "autorange": "reversed",
    }
    if depth_range:
        yaxis["range"] = [depth_range[1], depth_range[0]]
        yaxis.pop("autorange", None)
    figure.update_layout(
        **panel_layout(),
        dragmode="pan",
        xaxis={"title": "距离 (km)", "gridcolor": "#e2e8f0"},
        yaxis=yaxis,
    )
    title = (
        f"{display_label}垂直断面："
        f"({p1['lat']:.2f}°N, {p1['lon']:.2f}°E) → "
        f"({p2['lat']:.2f}°N, {p2['lon']:.2f}°E)"
    )
    info = f"总距离：{distance_km[-1]:.1f} km"
    return figure_to_dict(figure), title, info

