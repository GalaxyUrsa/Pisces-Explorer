"""Build the A, B and A-minus-B layer comparison response."""

from __future__ import annotations

from ..layer.figure import make_layer_fig
from .service import prepare_layer_comparison


def build_layer_comparison(
    pair: dict,
    *,
    variable: str,
    depth_idx: int,
    is_2d: bool,
    points: list,
    get_data,
    vmin: float | None,
    vmax: float | None,
    colorscale: str | None,
    previous_pair: dict | None = None,
) -> dict:
    """Build A, B and A-B layer figures plus slice metrics."""
    frame_a = pair["a"]
    prepared = prepare_layer_comparison(
        pair,
        variable=variable,
        depth_idx=depth_idx,
        is_2d=is_2d,
        get_data=get_data,
        previous_pair=previous_pair,
    )
    layer_a = prepared["layer_a"]
    layer_b = prepared["layer_b"]
    difference = prepared["difference"]
    difference_limit = prepared["difference_limit"]

    figure_arguments = {
        "lats": frame_a["lats"],
        "lons": frame_a["lons"],
        "depths": frame_a["depths"],
        "depth_idx": 0 if is_2d else depth_idx,
        "points": points,
        "variable": variable,
        "is_2d": is_2d,
    }
    return {
        "date": pair["date"],
        "figures": {
            "a": make_layer_fig(
                layer_a,
                **figure_arguments,
                vmin=vmin,
                vmax=vmax,
                colorscale=colorscale,
            ),
            "b": make_layer_fig(
                layer_b,
                **figure_arguments,
                vmin=vmin,
                vmax=vmax,
                colorscale=colorscale,
            ),
            "difference": make_layer_fig(
                difference,
                **figure_arguments,
                vmin=-difference_limit,
                vmax=difference_limit,
                colorscale="RdBu_r",
            ),
        },
        "difference_range": [-difference_limit, difference_limit],
        "metrics": prepared["metrics"],
        "stats": prepared["stats"],
        "change_from_previous": prepared["change_from_previous"],
    }
