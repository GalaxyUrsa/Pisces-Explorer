"""Load uploaded NetCDF files while owning temporary-file cleanup."""

from __future__ import annotations

import os
import tempfile

from fastapi import UploadFile

from ...data import load_from_path, load_series
from ...core.runtime import current_runtime_scope, runtime


def _active_region():
    if current_runtime_scope() != "region":
        return None
    selection = runtime.state.get("region_selection")
    if not selection:
        raise ValueError("请先确定研究区域")
    return selection["bounds"]


async def _copy_upload(upload: UploadFile, temporary) -> None:
    while chunk := await upload.read(1024 * 1024):
        temporary.write(chunk)


async def load_uploaded_file(upload: UploadFile) -> dict:
    """Load one uploaded NetCDF file and always remove its temporary copy."""
    path = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".nc") as temporary:
            await _copy_upload(upload, temporary)
            path = temporary.name
        return load_from_path(path, _active_region())
    finally:
        if path is not None:
            try:
                os.unlink(path)
            except OSError:
                pass


async def load_uploaded_series(files: list[UploadFile]) -> list[dict]:
    """Load a filename-sorted upload series and clean every temporary copy."""
    temporary_paths: list[tuple[str, str]] = []
    try:
        for upload in files:
            with tempfile.NamedTemporaryFile(delete=False, suffix=".nc") as temporary:
                await _copy_upload(upload, temporary)
                temporary_paths.append((temporary.name, upload.filename))
        temporary_paths.sort(key=lambda item: item[1])
        return load_series(temporary_paths, _active_region())
    finally:
        for path, _ in temporary_paths:
            try:
                os.unlink(path)
            except OSError:
                pass
