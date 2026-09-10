"""Build the three-dimensional layered Plotly figure."""

from __future__ import annotations

import numpy as np
import plotly.graph_objects as go

from ...plotting.common import (
    apply_sentinel,
    colorbar_style,
    figure_to_dict,
    nan_colorscale,
    variable_meta,
)


def make_volume_fig(
    data,
    lats,
    lons,
    depths,
    variable: str = "ss",
    vmin: float = None,
    vmax: float = None,
    colorscale: str = None,
    colorscale_custom: list = None,
    depth_indices: list = None,
    sample_step: int = 8,
    max_depth_layers: int | None = None,
) -> dict:
    meta = variable_meta(variable)
    depth_count = len(depths)
    vmin = vmin if vmin is not None else float(np.nanmin(data))
    vmax = vmax if vmax is not None else float(np.nanmax(data))
    if colorscale_custom and len(colorscale_custom) == 2:
        colorscale_input = [
            [0.0, colorscale_custom[0]],
            [1.0, colorscale_custom[1]],
        ]
    else:
        colorscale_input = colorscale or meta["colorscale"]

    if depth_indices is None:
        depth_indices = list(range(0, depth_count, 2))
    else:
        depth_indices = [
            index for index in depth_indices if 0 <= index < depth_count
        ]
    if not depth_indices:
        depth_indices = [0]
    if max_depth_layers and len(depth_indices) > max_depth_layers:
        positions = np.linspace(
            0, len(depth_indices) - 1, max_depth_layers, dtype=int
        )
        depth_indices = [depth_indices[position] for position in positions]

    step = max(1, int(sample_step))
    sampled_data = data[:, ::step, ::step]
    sampled_lats = lats[::step]
    sampled_lons = lons[::step]
    longitude_grid, latitude_grid = np.meshgrid(sampled_lons, sampled_lats)
    depth_display = (depths - depths[0]) / (depths[-1] - depths[0])
    colorscale_value, sentinel = nan_colorscale(
        colorscale_input, vmin, vmax
    )

    figure = go.Figure()
    for index in depth_indices:
        layer = sampled_data[index]
        depth_label = f"{depths[index]:.1f} m"
        z_values = np.where(np.isnan(layer), np.nan, depth_display[index])
        plotted_layer = apply_sentinel(layer, sentinel, vmin, vmax)
        figure.add_trace(
            go.Surface(
                uid=f"volume-layer-{index}",
                x=longitude_grid,
                y=latitude_grid,
                z=z_values,
                surfacecolor=plotted_layer,
                hovertemplate=(
                    "Lon: %{x:.6f}°E  Lat: %{y:.6f}°N<br>"
                    f"Depth: {depth_label}<extra></extra>"
                ),
                colorscale=colorscale_value,
                cmin=sentinel,
                cmax=vmax,
                showscale=index == depth_indices[0],
                colorbar=(
                    colorbar_style(meta["unit"])
                    if index == depth_indices[0]
                    else None
                ),
                opacity=0.85,
                name=depth_label,
            )
        )

    figure.update_layout(
        paper_bgcolor="#ffffff",
        font={"color": "#334155"},
        margin={"l": 0, "r": 60, "t": 30, "b": 10},
        scene={
            "xaxis": {
                "title": {"text": "Lon (°E)", "font": {"color": "#334155"}},
                "backgroundcolor": "#ffffff",
                "gridcolor": "#e2e8f0",
                "showbackground": True,
                "color": "#334155",
            },
            "yaxis": {
                "title": {"text": "Lat (°N)", "font": {"color": "#334155"}},
                "backgroundcolor": "#ffffff",
                "gridcolor": "#e2e8f0",
                "showbackground": True,
                "color": "#334155",
            },
            "zaxis": {
                "title": {"text": "Depth", "font": {"color": "#334155"}},
                "backgroundcolor": "#ffffff",
                "gridcolor": "#e2e8f0",
                "showbackground": True,
                "color": "#334155",
                "tickvals": depth_display[::4].tolist(),
                "ticktext": [
                    f"{depths[index]:.0f}m"
                    for index in range(0, depth_count, 4)
                ],
                "range": [1, 0],
            },
            "bgcolor": "#ffffff",
            "camera": {"eye": {"x": 1.6, "y": -1.6, "z": 0.8}},
            "aspectmode": "manual",
            "aspectratio": {"x": 2, "y": 1.5, "z": 0.8},
        },
        legend={"visible": False},
    )
    return figure_to_dict(figure)
