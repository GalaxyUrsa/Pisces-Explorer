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
    get_scalar_data=None,
    vmin: float | None,
    vmax: float | None,
    colorscale: str | None,
    quiver_step: int = 20,
    previous_pair: dict | None = None,
    display_data: dict | None = None,
    previous_display_data: dict | None = None,
    plot_step: int = 2,
    json_safe_nan: bool = False,
) -> dict:
    """Build A, B and A-B layer figures plus slice metrics."""
    frame_a = pair["a"]
    prepared = prepare_layer_comparison(
        pair,
        variable=variable,
        depth_idx=depth_idx,
        is_2d=is_2d,
        get_data=get_data,
        get_scalar_data=get_scalar_data,
        previous_pair=previous_pair,
        layer_values=(
            {side: display_data[side]["scalar"] for side in ("a", "b")}
            if display_data is not None else None
        ),
        previous_layer_values=(
            {side: previous_display_data[side]["scalar"] for side in ("a", "b")}
            if previous_display_data is not None else None
        ),
    )
    layer_a = prepared["layer_a"]
    layer_b = prepared["layer_b"]
    difference = prepared["difference"]
    difference_limit = prepared["difference_limit"]

    def quiver_components(frame):
        if display_data is not None:
            side = "a" if frame is pair["a"] else "b"
            return display_data[side]["components"]
        if variable == "mwd":
            components = frame.get("mwd_u"), frame.get("mwd_v")
        else:
            values = get_data(variable, frame)
            components = values if isinstance(values, tuple) else (None, None)
        u_values, v_values = components
        if u_values is None or v_values is None:
            return None
        if not is_2d:
            u_values = u_values[depth_idx]
            v_values = v_values[depth_idx]
        return u_values, v_values

    components_a = quiver_components(pair["a"])
    components_b = quiver_components(pair["b"])
    quiver_a = (
        (*components_a, quiver_step) if components_a is not None else None
    )
    quiver_b = (
        (*components_b, quiver_step) if components_b is not None else None
    )
    quiver_difference = (
        (
            components_a[0] - components_b[0],
            components_a[1] - components_b[1],
            quiver_step,
        )
        if components_a is not None and components_b is not None
        else None
    )

    figure_arguments = {
        "lats": display_data["a"]["lats"] if display_data is not None else frame_a["lats"],
        "lons": display_data["a"]["lons"] if display_data is not None else frame_a["lons"],
        "depths": frame_a["depths"],
        "depth_idx": 0 if is_2d else depth_idx,
        "points": points,
        "variable": variable,
        "is_2d": is_2d,
    }
    quiver_metadata = {"a": {}, "b": {}, "difference": {}}
    return {
        "date": pair["date"],
        "source_dates": pair.get("source_dates", {}),
        "figures": {
            "a": make_layer_fig(
                layer_a,
                **figure_arguments,
                vmin=vmin,
                vmax=vmax,
                colorscale=colorscale,
                quiver_uv=quiver_a,
                quiver_metadata=quiver_metadata["a"],
                plot_step=plot_step,
                json_safe_nan=json_safe_nan,
            ),
            "b": make_layer_fig(
                layer_b,
                **figure_arguments,
                vmin=vmin,
                vmax=vmax,
                colorscale=colorscale,
                quiver_uv=quiver_b,
                quiver_metadata=quiver_metadata["b"],
                plot_step=plot_step,
                json_safe_nan=json_safe_nan,
            ),
            "difference": make_layer_fig(
                difference,
                **figure_arguments,
                vmin=-difference_limit,
                vmax=difference_limit,
                colorscale="RdBu_r",
                quiver_uv=quiver_difference,
                quiver_metadata=quiver_metadata["difference"],
                plot_step=plot_step,
                json_safe_nan=json_safe_nan,
            ),
        },
        "quiver": {
            source: metadata or None
            for source, metadata in quiver_metadata.items()
        },
        "difference_range": [-difference_limit, difference_limit],
        "metrics": prepared["metrics"],
        "stats": prepared["stats"],
        "change_from_previous": prepared["change_from_previous"],
    }
