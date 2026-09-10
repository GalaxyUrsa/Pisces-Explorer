"""Compatibility exports for the comparison feature.

New code should import from ``backend.features.comparison`` modules.
"""

from .features.comparison.figure import build_layer_comparison  # noqa: F401
from .features.comparison.service import (  # noqa: F401
    COMPARISON_SOURCES,
    comparison_data,
    pair_frames,
    pair_series,
    shared_ranges,
    single_comparison_label,
    unchanged_dates,
)
