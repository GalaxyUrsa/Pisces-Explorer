"""Plotly serialization, metadata and shared visual styles."""

from __future__ import annotations

import json

import numpy as np
import plotly.graph_objects as go

from ..core.variables import get_variable


class NumpyEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, np.ndarray):
            return obj.tolist()
        if isinstance(obj, np.integer):
            return int(obj)
        if isinstance(obj, np.floating):
            return float(obj)
        return super().default(obj)


def figure_to_dict(figure) -> dict:
    raw = figure.to_dict()
    return json.loads(json.dumps(raw, cls=NumpyEncoder, ensure_ascii=False))


def nan_colorscale(name_or_list, vmin: float, vmax: float):
    """Return a colorscale and sentinel with a transparent NaN slot."""
    import plotly.colors as colors

    scale = (
        name_or_list
        if isinstance(name_or_list, list)
        else colors.get_colorscale(name_or_list)
    )
    span = vmax - vmin if vmax != vmin else 1.0
    sentinel = vmin - span * 0.01
    total = vmax - sentinel
    first_valid_position = (vmin - sentinel) / total
    shifted = [
        [
            first_valid_position
            + stop[0] * (1.0 - first_valid_position),
            stop[1],
        ]
        for stop in scale
    ]
    colorscale = [
        [0.0, "rgba(0,0,0,0)"],
        [first_valid_position * 0.5, shifted[0][1]],
        *shifted[1:],
    ]
    return colorscale, sentinel


def apply_sentinel(data, sentinel: float, vmin: float, vmax: float):
    """Replace NaN with a sentinel and clamp valid values to the color range."""
    output = np.array(data, dtype=float)
    valid = ~np.isnan(output)
    output[valid] = np.clip(output[valid], vmin, vmax)
    output[~valid] = sentinel
    return output


def variable_meta(variable: str) -> dict:
    spec = get_variable(variable)
    return {
        "label": spec.label,
        "unit": spec.unit,
        "colorscale": spec.colorscale,
        "line_color": spec.line_color,
        "vmin": spec.default_min,
        "vmax": spec.default_max,
    }


def colorbar_style(unit: str = "m/s", length: float = 0.8):
    return {
        "title": {
            "text": unit,
            "font": {"color": "#334155", "size": 11},
            "side": "top",
        },
        "tickfont": {"color": "#64748b", "size": 10},
        "bgcolor": "#ffffff",
        "bordercolor": "#e2e8f0",
        "orientation": "v",
        "x": 1.01,
        "xanchor": "left",
        "y": 0.5,
        "yanchor": "middle",
        "len": length,
        "thickness": 12,
    }


def panel_layout(**extra):
    layout = {
        "paper_bgcolor": "#ffffff",
        "plot_bgcolor": "#ffffff",
        "font": {"color": "#334155"},
        "margin": {"l": 10, "r": 60, "t": 10, "b": 10},
    }
    layout.update(extra)
    return layout


def empty_figure(message: str) -> dict:
    figure = go.Figure()
    figure.add_annotation(
        text=message,
        x=0.5,
        y=0.5,
        xref="paper",
        yref="paper",
        showarrow=False,
        font={"size": 13, "color": "#94a3b8"},
    )
    figure.update_layout(
        paper_bgcolor="#ffffff",
        plot_bgcolor="#ffffff",
        font={"color": "#334155"},
        margin={"l": 10, "r": 10, "t": 10, "b": 10},
        xaxis={"visible": False},
        yaxis={"visible": False},
    )
    return figure_to_dict(figure)

