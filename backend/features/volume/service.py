"""Prepare and cache volume data independently from the HTTP route."""

from __future__ import annotations

from .figure import make_volume_fig


def ensure_volume(runtime, variable: str):
    """Return the cached default volume figure for a single-frame session."""
    key = f"volume_{variable}"
    if key not in runtime.state:
        data = runtime.get_scalar_data(variable)
        runtime.state[key] = make_volume_fig(
            data,
            runtime.state["lats"],
            runtime.state["lons"],
            runtime.state["depths"],
            variable=variable,
            vmin=runtime.state.get(f"{variable}_min"),
            vmax=runtime.state.get(f"{variable}_max"),
        )
    return runtime.state[key]
