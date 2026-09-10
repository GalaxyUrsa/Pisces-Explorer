"""Per-variable display config persistence."""

import json
import os

from .core.paths import REGION_VISUALIZATION_CONFIG_PATH, VISUALIZATION_CONFIG_PATH
from .core.runtime import current_runtime_scope


CONFIG_PATH = str(VISUALIZATION_CONFIG_PATH)
REGION_CONFIG_PATH = str(REGION_VISUALIZATION_CONFIG_PATH)


def _config_path() -> str:
    return REGION_CONFIG_PATH if current_runtime_scope() == "region" else CONFIG_PATH

DEFAULTS: dict = {
    "ss":    {"min": 1480, "max": 1560, "colorscale": "Viridis",  "color_min": None, "color_max": None, "depth_min": None, "depth_max": None, "value_min": None, "value_max": None},
    "temp":  {"min": 0,    "max": 35,   "colorscale": "RdYlBu_r", "color_min": None, "color_max": None, "depth_min": None, "depth_max": None, "value_min": None, "value_max": None},
    "salt":  {"min": 30,   "max": 40,   "colorscale": "Blues",    "color_min": None, "color_max": None, "depth_min": None, "depth_max": None, "value_min": None, "value_max": None},
    "uo":    {"min": -1.5, "max": 1.5,  "colorscale": "RdBu_r",   "color_min": None, "color_max": None, "depth_min": None, "depth_max": None, "value_min": None, "value_max": None},
    "vo":    {"min": -1.5, "max": 1.5,  "colorscale": "RdBu_r",   "color_min": None, "color_max": None, "depth_min": None, "depth_max": None, "value_min": None, "value_max": None},
    "uv":    {"min": 0,    "max": 2,    "colorscale": "Viridis",  "color_min": None, "color_max": None, "depth_min": None, "depth_max": None, "value_min": None, "value_max": None},
    "u10":   {"min": -15,  "max": 15,   "colorscale": "RdBu_r",   "color_min": None, "color_max": None, "depth_min": None, "depth_max": None, "value_min": None, "value_max": None},
    "v10":   {"min": -15,  "max": 15,   "colorscale": "RdBu_r",   "color_min": None, "color_max": None, "depth_min": None, "depth_max": None, "value_min": None, "value_max": None},
    "wind":  {"min": 0,    "max": 20,   "colorscale": "YlOrRd",   "color_min": None, "color_max": None, "depth_min": None, "depth_max": None, "value_min": None, "value_max": None},
    "swh":   {"min": 0,    "max": 6,    "colorscale": "Blues",    "color_min": None, "color_max": None, "depth_min": None, "depth_max": None, "value_min": None, "value_max": None},
    "mwd_u": {"min": -1,   "max": 1,    "colorscale": "RdBu_r",   "color_min": None, "color_max": None, "depth_min": None, "depth_max": None, "value_min": None, "value_max": None},
    "mwd_v": {"min": -1,   "max": 1,    "colorscale": "RdBu_r",   "color_min": None, "color_max": None, "depth_min": None, "depth_max": None, "value_min": None, "value_max": None},
    "mwd":   {"min": 0,    "max": 1,    "colorscale": "Viridis",  "color_min": None, "color_max": None, "depth_min": None, "depth_max": None, "value_min": None, "value_max": None},
}


def load_config() -> dict:
    """Return saved config merged with DEFAULTS. Falls back to DEFAULTS on any error."""
    try:
        with open(_config_path(), "r", encoding="utf-8") as f:
            saved = json.load(f)
        result = {}
        for var, defaults in DEFAULTS.items():
            entry = saved.get(var, {})
            result[var] = {**defaults, **{k: v for k, v in entry.items() if k in defaults}}
        if "visible_layers" in saved:
            result["visible_layers"] = saved["visible_layers"]
        if isinstance(saved.get("workspace"), dict):
            result["workspace"] = saved["workspace"]
        region = saved.get("region")
        if (
            region is None
            or (
                isinstance(region, list)
                and len(region) == 4
                and all(isinstance(value, (int, float)) for value in region)
            )
        ):
            result["region"] = region
        return result
    except Exception:
        return {
            **{variable: dict(defaults) for variable, defaults in DEFAULTS.items()},
            "region": None,
        }


def save_config(cfg: dict) -> None:
    """Write cfg to the Pisces-Hub configuration directory."""
    path = _config_path()
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(cfg, f, indent=2, ensure_ascii=False)
