"""Adapter around the standalone Pisces-Simulator implementation."""

from __future__ import annotations

import importlib.util
from functools import lru_cache
from pathlib import Path


@lru_cache(maxsize=1)
def _simulator_module():
    root = Path(__file__).resolve().parents[3]
    source = root / "Pisces-Simulator" / "embed_idealized_eddy.py"
    if not source.is_file():
        raise FileNotFoundError(f"Simulator implementation not found: {source}")
    spec = importlib.util.spec_from_file_location("pisces_idealized_eddy", source)
    if spec is None or spec.loader is None:
        raise ImportError(f"Cannot import simulator implementation: {source}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def simulate_eddy(input_path, output_path, **parameters):
    return _simulator_module().embed_eddy(
        input_path, output_path, **parameters
    )
