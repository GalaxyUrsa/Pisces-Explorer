"""Adapter for the standalone Pisces-Ocean-Infer implementation."""

from __future__ import annotations

import importlib.util
import sys
from functools import lru_cache
from pathlib import Path


@lru_cache(maxsize=1)
def _inference_module():
    root = Path(__file__).resolve().parents[3]
    source_dir = root / "Pisces-Ocean-Infer"
    source = source_dir / "service.py"
    if not source.is_file():
        raise FileNotFoundError(f"Inference implementation not found: {source}")
    if str(source_dir) not in sys.path:
        sys.path.insert(0, str(source_dir))
    spec = importlib.util.spec_from_file_location(
        "pisces_ocean_inference_service", source
    )
    if spec is None or spec.loader is None:
        raise ImportError(f"Cannot import inference implementation: {source}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def run_inference(*args, **kwargs):
    return _inference_module().run_inference(*args, **kwargs)
