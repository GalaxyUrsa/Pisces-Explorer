"""Build a single-point vertical profile figure."""

from __future__ import annotations

import plotly.graph_objects as go

from ...data import nearest_idx
from ...plotting.common import figure_to_dict, panel_layout, variable_meta


def make_profile_fig(
    data,
    lats,
    lons,
    depths,
    lat: float,
    lon: float,
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
    line_color = "#7c3aed" if is_difference else meta["line_color"]
    latitude_index = nearest_idx(lats, lat)
    longitude_index = nearest_idx(lons, lon)
    profile = data[:, latitude_index, longitude_index]
    selected_depth = float(depths[depth_idx])

    figure = go.Figure()
    figure.add_trace(
        go.Scatter(
            x=profile,
            y=depths,
            mode="lines+markers",
            line={"color": line_color, "width": 2},
            marker={"size": 5, "color": line_color},
            hovertemplate=(
                f"{display_label}: %{{x:.2f}} {meta['unit']}"
                "<br>深度: %{y:.1f} m<extra></extra>"
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
    xaxis = {
        "title": f"{display_label} ({meta['unit']})",
        "gridcolor": "#e2e8f0",
    }
    if depth_range:
        yaxis["range"] = [depth_range[1], depth_range[0]]
        yaxis.pop("autorange", None)
    if value_range:
        xaxis["range"] = list(value_range)

    figure.update_layout(
        **panel_layout(), dragmode="pan", xaxis=xaxis, yaxis=yaxis
    )
    title = (
        f"{display_label}垂直剖面："
        f"{float(lats[latitude_index]):.2f}°N, "
        f"{float(lons[longitude_index]):.2f}°E"
    )
    info = (
        f"网格点：{float(lats[latitude_index]):.3f}°N, "
        f"{float(lons[longitude_index]):.3f}°E"
    )
    return figure_to_dict(figure), title, info

