"""Canonical persistent storage paths for the local Pisces platform."""

from __future__ import annotations

import sys
from pathlib import Path


def _application_root() -> Path:
    if getattr(sys, "frozen", False):
        return Path(sys.executable).resolve().parent
    return Path(__file__).resolve().parents[2]


APPLICATION_ROOT = _application_root()
HUB_ROOT = APPLICATION_ROOT / "Pisces-Hub"
HUB_DATA_DIR = HUB_ROOT / "data"
HUB_MODELS_DIR = HUB_ROOT / "models"
HUB_LEGACY_WEIGHTS_DIR = HUB_ROOT / "weights"
HUB_RESULTS_DIR = HUB_ROOT / "results"
HUB_CONFIGS_DIR = HUB_ROOT / "configs"

SIMULATOR_RESULTS_DIR = HUB_RESULTS_DIR / "simulator"
INFERENCE_RESULTS_DIR = HUB_RESULTS_DIR / "inference"
VISUALIZATION_CONFIG_PATH = HUB_CONFIGS_DIR / "viz_config.json"
REGION_VISUALIZATION_CONFIG_PATH = APPLICATION_ROOT / "Pisces-Region" / "viz_config.json"
