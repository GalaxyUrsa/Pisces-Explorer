"""Registry of API feature modules exposed by Pisces-Explorer."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class FeatureSpec:
    key: str
    label: str
    router_module: str
    modes: tuple[str, ...]


FEATURE_REGISTRY = {
    spec.key: spec
    for spec in (
        FeatureSpec(
            "dataset",
            "数据导入",
            "backend.features.dataset.router",
            ("single", "series", "comparison"),
        ),
        FeatureSpec(
            "volume",
            "三维分层",
            "backend.features.volume.router",
            ("single", "series", "comparison"),
        ),
        FeatureSpec(
            "layer",
            "水平切层",
            "backend.features.layer.router",
            ("single", "series", "comparison"),
        ),
        FeatureSpec(
            "profile",
            "单点垂直剖面",
            "backend.features.profile.router",
            ("single", "series", "comparison"),
        ),
        FeatureSpec(
            "transect",
            "两点垂直断面",
            "backend.features.transect.router",
            ("single", "series", "comparison"),
        ),
        FeatureSpec(
            "comparison",
            "序列对比",
            "backend.features.comparison.router",
            ("comparison",),
        ),
    )
}


def public_features() -> list[dict]:
    return [
        {
            "key": spec.key,
            "label": spec.label,
            "modes": list(spec.modes),
        }
        for spec in FEATURE_REGISTRY.values()
    ]
