"""Read and write task metadata stored beside Hub results."""

from __future__ import annotations

import json
from pathlib import Path


MANIFEST_FILENAME = "manifest.json"


def read_manifest(run_dir: Path) -> dict | None:
    path = run_dir / MANIFEST_FILENAME
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None
    return value if isinstance(value, dict) else None


def write_manifest(run_dir: Path, value: dict) -> Path:
    path = run_dir / MANIFEST_FILENAME
    temporary = run_dir / f"{MANIFEST_FILENAME}.tmp"
    temporary.write_text(
        json.dumps(value, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    temporary.replace(path)
    return path
