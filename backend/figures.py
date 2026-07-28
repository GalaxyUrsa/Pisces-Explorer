"""Compatibility exports for figure builders moved into feature modules.

New code should import from ``backend.features.<feature>.figure`` directly.
"""

from .features.layer.figure import make_layer_fig, make_quiver_trace
from .features.profile.figure import make_profile_fig
from .features.transect.figure import make_transect_fig
from .features.volume.figure import make_volume_fig
from .plotting.common import (
    apply_sentinel as _apply_sentinel,
    colorbar_style as _colorbar_style,
    empty_figure as _empty_fig,
    figure_to_dict as _fig_to_dict,
    nan_colorscale as _nan_colorscale,
    panel_layout as _panel_layout,
    variable_meta as _var_meta,
)


__all__ = [
    "make_layer_fig",
    "make_profile_fig",
    "make_quiver_trace",
    "make_transect_fig",
    "make_volume_fig",
]
