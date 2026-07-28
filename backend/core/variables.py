"""Central registry for supported visualization variables."""

from __future__ import annotations

from dataclasses import asdict, dataclass


@dataclass(frozen=True)
class VariableSpec:
    key: str
    label: str
    unit: str
    dimensions: str
    colorscale: str
    line_color: str
    default_min: float
    default_max: float
    components: tuple[str, str] | None = None
    quiver: bool = False

    def as_metadata(self) -> dict:
        metadata = asdict(self)
        metadata["vmin"] = metadata.pop("default_min")
        metadata["vmax"] = metadata.pop("default_max")
        return metadata


def _spec(
    key,
    label,
    unit,
    dimensions,
    colorscale,
    line_color,
    vmin,
    vmax,
    *,
    components=None,
    quiver=False,
):
    return VariableSpec(
        key=key,
        label=label,
        unit=unit,
        dimensions=dimensions,
        colorscale=colorscale,
        line_color=line_color,
        default_min=vmin,
        default_max=vmax,
        components=components,
        quiver=quiver,
    )


VARIABLE_REGISTRY = {
    spec.key: spec
    for spec in (
        _spec("ss", "声速", "m/s", "3d", "Viridis", "#58a6ff", 1480, 1560),
        _spec("temp", "温度", "°C", "3d", "RdYlBu_r", "#ff9f43", 0, 35),
        _spec("salt", "盐度", "PSU", "3d", "Blues", "#48dbfb", 30, 40),
        _spec("uo", "东向流速", "m/s", "3d", "RdBu_r", "#a29bfe", -1.5, 1.5),
        _spec("vo", "北向流速", "m/s", "3d", "RdBu_r", "#a29bfe", -1.5, 1.5),
        _spec(
            "uv", "流速", "m/s", "3d", "Viridis", "#a29bfe", 0, 2,
            components=("uo", "vo"), quiver=True,
        ),
        _spec("u10", "风速u", "m/s", "2d", "RdBu_r", "#fd79a8", -15, 15),
        _spec("v10", "风速v", "m/s", "2d", "RdBu_r", "#fd79a8", -15, 15),
        _spec(
            "wind", "风速", "m/s", "2d", "YlOrRd", "#fd79a8", 0, 20,
            components=("u10", "v10"), quiver=True,
        ),
        _spec("swh", "有效波高", "m", "2d", "Blues", "#74b9ff", 0, 6),
        _spec("mwd_u", "波向u", "", "2d", "RdBu_r", "#55efc4", -1, 1),
        _spec("mwd_v", "波向v", "", "2d", "RdBu_r", "#55efc4", -1, 1),
        _spec(
            "mwd", "波向", "°", "2d", "HSV", "#55efc4", 0, 360,
            components=("mwd_u", "mwd_v"), quiver=True,
        ),
    )
}

VARIABLES = frozenset(VARIABLE_REGISTRY)
VARS_3D = frozenset(
    key for key, spec in VARIABLE_REGISTRY.items() if spec.dimensions == "3d"
)
VARS_2D = frozenset(
    key for key, spec in VARIABLE_REGISTRY.items() if spec.dimensions == "2d"
)
VARS_VECTOR = frozenset(
    key for key, spec in VARIABLE_REGISTRY.items()
    if spec.components is not None and key != "mwd"
)


def get_variable(key: str) -> VariableSpec:
    return VARIABLE_REGISTRY.get(key, VARIABLE_REGISTRY["ss"])


def public_registry() -> dict[str, dict]:
    return {key: spec.as_metadata() for key, spec in VARIABLE_REGISTRY.items()}
