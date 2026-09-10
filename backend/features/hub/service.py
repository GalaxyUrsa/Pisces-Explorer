"""Discover and safely resolve persistent Pisces-Hub assets."""

from __future__ import annotations

import base64
import shutil
from pathlib import Path

from ...core.paths import (
    HUB_DATA_DIR,
    HUB_LEGACY_WEIGHTS_DIR,
    HUB_MODELS_DIR,
    HUB_ROOT,
    INFERENCE_RESULTS_DIR,
    SIMULATOR_RESULTS_DIR,
)
from .manifest import read_manifest


MODEL_SUFFIXES = {".pth", ".pt", ".ckpt"}


def _asset_id(path: Path) -> str:
    relative = path.resolve().relative_to(HUB_ROOT.resolve()).as_posix()
    return base64.urlsafe_b64encode(relative.encode()).decode().rstrip("=")


def _file_info(path: Path) -> dict:
    stat = path.stat()
    return {
        "filename": path.name,
        "size_bytes": stat.st_size,
        "created_at_ms": int(stat.st_mtime * 1000),
    }


def _file_asset(path: Path, asset_type: str, source: str) -> dict:
    return {
        "id": _asset_id(path),
        "asset_type": asset_type,
        "source": source,
        "name": path.name,
        "kind": "file",
        **_file_info(path),
    }


def _files(root: Path, suffixes: set[str], recursive: bool = True):
    if not root.is_dir():
        return []
    candidates = root.rglob("*") if recursive else root.glob("*")
    return [
        path
        for path in candidates
        if path.is_file() and path.suffix.lower() in suffixes
    ]


def list_assets() -> list[dict]:
    assets = []
    assets.extend(
        _file_asset(path, "netcdf", "data")
        for path in _files(HUB_DATA_DIR, {".nc"})
    )
    # Preserve access to files stored at the Hub root before data/ was added.
    assets.extend(
        _file_asset(path, "netcdf", "data")
        for path in _files(HUB_ROOT, {".nc"}, recursive=False)
    )
    assets.extend(
        _file_asset(path, "netcdf", "simulator")
        for path in _files(SIMULATOR_RESULTS_DIR, {".nc"}, recursive=False)
    )
    if SIMULATOR_RESULTS_DIR.is_dir():
        for run_dir in SIMULATOR_RESULTS_DIR.iterdir():
            if not run_dir.is_dir():
                continue
            outputs = sorted(run_dir.glob("*.nc"))
            if not outputs:
                continue
            output = outputs[0]
            manifest = read_manifest(run_dir)
            asset = {
                "id": _asset_id(run_dir),
                "asset_type": "netcdf",
                "source": "simulator",
                "name": output.name,
                "run_id": run_dir.name,
                "kind": "bundle",
                "filename": output.name,
                **_file_info(output),
                "files": [_file_info(path) for path in outputs],
            }
            if manifest:
                asset.update(
                    {
                        "parameters": manifest.get("parameters", {}),
                        "input": manifest.get("input"),
                        "manifest": manifest,
                    }
                )
            assets.append(asset)

    if INFERENCE_RESULTS_DIR.is_dir():
        for run_dir in INFERENCE_RESULTS_DIR.iterdir():
            if not run_dir.is_dir():
                continue
            outputs = sorted(run_dir.glob("prediction_*.nc"))
            if not outputs:
                continue
            newest = max(path.stat().st_mtime for path in outputs)
            manifest = read_manifest(run_dir)
            asset = {
                "id": _asset_id(run_dir),
                "asset_type": "netcdf",
                "source": "inference",
                "name": run_dir.name,
                "kind": "series",
                "filename": outputs[-1].name,
                "size_bytes": sum(path.stat().st_size for path in outputs),
                "created_at_ms": int(newest * 1000),
                "files": [_file_info(path) for path in outputs],
            }
            if manifest:
                asset.update(
                    {
                        "parameters": manifest.get("parameters", {}),
                        "input": manifest.get("input"),
                        "weights": manifest.get("weights"),
                        "manifest": manifest,
                    }
                )
            assets.append(asset)

    for root in (HUB_MODELS_DIR, HUB_LEGACY_WEIGHTS_DIR):
        assets.extend(
            _file_asset(path, "model", "model")
            for path in _files(root, MODEL_SUFFIXES)
        )

    return sorted(
        assets,
        key=lambda item: item["created_at_ms"],
        reverse=True,
    )


def get_asset(asset_id: str) -> dict:
    return next(
        (asset for asset in list_assets() if asset["id"] == asset_id),
        None,
    )


def _asset_path(asset: dict) -> Path:
    padding = "=" * (-len(asset["id"]) % 4)
    try:
        relative = base64.urlsafe_b64decode(
            asset["id"] + padding
        ).decode()
    except (ValueError, UnicodeDecodeError) as error:
        raise ValueError("Invalid Hub asset id.") from error
    path = (HUB_ROOT / relative).resolve()
    if not path.is_relative_to(HUB_ROOT.resolve()):
        raise ValueError("Invalid Hub asset path.")
    return path


def resolve_asset_file(
    asset: dict,
    *,
    member: str | None = None,
    asset_type: str | None = None,
) -> Path:
    if asset_type and asset["asset_type"] != asset_type:
        raise ValueError(f"Hub asset must be {asset_type}.")
    path = _asset_path(asset)
    if asset["kind"] == "file":
        if member:
            raise ValueError("This Hub asset has no members.")
        return path
    filenames = {item["filename"] for item in asset.get("files", [])}
    selected = member or asset["filename"]
    if selected not in filenames or selected != Path(selected).name:
        raise ValueError("Invalid Hub asset member.")
    member_path = (path / selected).resolve()
    if member_path.parent != path or not member_path.is_file():
        raise ValueError("Hub asset member not found.")
    return member_path


def delete_asset(asset: dict) -> None:
    path = _asset_path(asset)
    if asset["kind"] in {"series", "bundle"}:
        shutil.rmtree(path)
    else:
        path.unlink()
