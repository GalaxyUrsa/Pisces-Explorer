"""Build horizontal layer heatmaps and vector-arrow overlays."""

from __future__ import annotations

import numpy as np
import plotly.graph_objects as go

from ...plotting.common import (
    colorbar_style,
    figure_to_dict,
    panel_layout,
    variable_meta,
)

MAX_QUIVER_ARROWS = 2500


def _resolve_quiver_step(u, v, requested_step: int, max_arrows: int):
    requested_step = max(1, int(requested_step))
    effective_step = requested_step
    largest_dimension = max(u.shape[-2:])

    while True:
        sampled_u = u[::effective_step, ::effective_step]
        sampled_v = v[::effective_step, ::effective_step]
        magnitude = np.sqrt(sampled_u ** 2 + sampled_v ** 2)
        valid = (
            np.isfinite(sampled_u)
            & np.isfinite(sampled_v)
            & (magnitude > 0)
        )
        arrow_count = int(np.count_nonzero(valid))
        if arrow_count <= max_arrows or effective_step >= largest_dimension:
            return effective_step, arrow_count
        effective_step += 1


def make_quiver_trace(
    u,
    v,
    lats,
    lons,
    step: int = 20,
    scale_factor: float = 0.4,
    metadata: dict | None = None,
    max_arrows: int = MAX_QUIVER_ARROWS,
):
    """Build vectorized arrow traces over a heatmap."""
    requested_step = max(1, int(step))
    step, arrow_count = _resolve_quiver_step(
        u, v, requested_step, max_arrows
    )
    if metadata is not None:
        metadata.update(
            {
                "requested_step": requested_step,
                "effective_step": step,
                "arrow_count": arrow_count,
                "max_arrows": max_arrows,
            }
        )
    sampled_lats = lats[::step]
    sampled_lons = lons[::step]
    sampled_u = u[::step, ::step]
    sampled_v = v[::step, ::step]

    latitude_step = (
        float(abs(sampled_lats[1] - sampled_lats[0]))
        if len(sampled_lats) > 1
        else 1.0
    )
    longitude_step = (
        float(abs(sampled_lons[1] - sampled_lons[0]))
        if len(sampled_lons) > 1
        else 1.0
    )
    scale = min(latitude_step, longitude_step) * scale_factor
    magnitude = np.sqrt(sampled_u ** 2 + sampled_v ** 2)
    valid = (
        np.isfinite(sampled_u)
        & np.isfinite(sampled_v)
        & (magnitude > 0)
    )
    if not np.any(valid):
        return None
    max_magnitude = float(np.max(magnitude[valid]))

    longitude_grid, latitude_grid = np.meshgrid(
        sampled_lons, sampled_lats
    )
    longitude_start = longitude_grid[valid]
    latitude_start = latitude_grid[valid]
    valid_u = sampled_u[valid]
    valid_v = sampled_v[valid]
    valid_magnitude = magnitude[valid]

    fraction = 0.2 + 0.8 * (valid_magnitude / max_magnitude)
    longitude_delta = (
        valid_u / valid_magnitude
    ) * scale * fraction
    latitude_delta = (
        valid_v / valid_magnitude
    ) * scale * fraction
    longitude_end = longitude_start + longitude_delta
    latitude_end = latitude_start + latitude_delta

    nan_column = np.full(len(longitude_start), np.nan)
    shaft_x = np.stack(
        [longitude_start, longitude_end, nan_column], axis=1
    ).ravel()
    shaft_y = np.stack(
        [latitude_start, latitude_end, nan_column], axis=1
    ).ravel()
    mathematical_angle = np.degrees(
        np.arctan2(latitude_delta, longitude_delta)
    )

    shaft_trace = go.Scattergl(
        x=shaft_x,
        y=shaft_y,
        mode="lines",
        line={"color": "rgba(20,20,20,0.7)", "width": 2},
        showlegend=False,
        hoverinfo="skip",
    )
    head_trace = go.Scattergl(
        x=longitude_end.tolist(),
        y=latitude_end.tolist(),
        mode="markers",
        marker={
            "symbol": "arrow",
            "size": 10,
            "angle": 90.0 - mathematical_angle,
            "color": "rgba(20,20,20,0.85)",
            "line": {"width": 0},
        },
        showlegend=False,
        hoverinfo="skip",
    )
    return shaft_trace, head_trace


def make_layer_fig(
    data,
    lats,
    lons,
    depths,
    depth_idx: int,
    points: list,
    variable: str = "ss",
    vmin: float = None,
    vmax: float = None,
    colorscale: str = None,
    colorscale_custom: list = None,
    quiver_uv: tuple = None,
    quiver_metadata: dict | None = None,
    is_2d: bool = False,
    plot_step: int = 2,
    json_safe_nan: bool = False,
) -> dict:
    meta = variable_meta(variable)
    if colorscale_custom and len(colorscale_custom) == 2:
        colorscale_input = [
            [0.0, colorscale_custom[0]],
            [1.0, colorscale_custom[1]],
        ]
    else:
        colorscale_input = colorscale or meta["colorscale"]
    vmin = vmin if vmin is not None else float(np.nanmin(data))
    vmax = vmax if vmax is not None else float(np.nanmax(data))
    full_layer = data if is_2d or data.ndim == 2 else data[depth_idx]

    step = plot_step
    plotted_layer = full_layer[::step, ::step]
    if json_safe_nan:
        # Starlette's strict JSON encoder rejects NaN. Plotly renders None as
        # a transparent cell, preserving Region's land mask.
        plotted_layer = np.where(np.isfinite(plotted_layer), plotted_layer, None)
    plotted_lats = lats[::step]
    plotted_lons = lons[::step]

    figure = go.Figure()
    figure.add_trace(
        go.Heatmap(
            z=plotted_layer,
            x=plotted_lons,
            y=plotted_lats,
            colorscale=colorscale_input,
            zmin=vmin,
            zmax=vmax,
            colorbar=colorbar_style(meta["unit"]),
            zsmooth=False,
            hovertemplate=(
                "Lon: %{x:.2f}°E<br>Lat: %{y:.2f}°N<br>"
                f"{meta['label']}: %{{z:.2f}} {meta['unit']}"
                "<extra></extra>"
            ),
        )
    )

    if quiver_uv is not None:
        u_values, v_values, quiver_step = quiver_uv
        scale_factor = 0.8 if variable == "uv" else 0.4
        traces = make_quiver_trace(
            u_values,
            v_values,
            lats,
            lons,
            quiver_step,
            scale_factor=scale_factor,
            metadata=quiver_metadata,
        )
        if traces is not None:
            figure.add_trace(traces[0])
            figure.add_trace(traces[1])

    if points:
        figure.add_trace(
            go.Scattergl(
                x=[point["lon"] for point in points],
                y=[point["lat"] for point in points],
                mode="markers+text",
                marker={
                    "color": "#ff7b72",
                    "size": 10,
                    "line": {"color": "white", "width": 1.5},
                },
                text=[f"P{index + 1}" for index in range(len(points))],
                textposition="top right",
                textfont={"color": "white", "size": 11},
                meta={"role": "selection-points"},
                showlegend=False,
                hoverinfo="skip",
            )
        )
        if len(points) == 2:
            figure.add_trace(
                go.Scattergl(
                    x=[points[0]["lon"], points[1]["lon"]],
                    y=[points[0]["lat"], points[1]["lat"]],
                    mode="lines",
                    line={
                        "color": "#ff7b72",
                        "width": 2,
                        "dash": "dash",
                    },
                    meta={"role": "selection-line"},
                    showlegend=False,
                    hoverinfo="skip",
                )
            )

    figure.update_layout(
        **panel_layout(margin={"l": 40, "r": 60, "t": 10, "b": 40}),
        dragmode="pan",
        xaxis={
            "title": "",
            "gridcolor": "#e2e8f0",
            "automargin": False,
            "range": [float(lons[0]), float(lons[-1])],
        },
        yaxis={
            "title": "",
            "gridcolor": "#e2e8f0",
            "automargin": False,
            "range": [float(lats[0]), float(lats[-1])],
        },
    )
    return figure_to_dict(figure)
