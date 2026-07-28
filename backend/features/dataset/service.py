"""Load uploaded NetCDF files while owning temporary-file cleanup."""

from __future__ import annotations

import os
import tempfile

from fastapi import UploadFile

from ...data import load_from_path, load_series


async def load_uploaded_file(upload: UploadFile) -> dict:
    """Load one uploaded NetCDF file and always remove its temporary copy."""
    path = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".nc") as temporary:
            temporary.write(await upload.read())
            path = temporary.name
        return load_from_path(path)
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
                temporary.write(await upload.read())
                temporary_paths.append((temporary.name, upload.filename))
        temporary_paths.sort(key=lambda item: item[1])
        return load_series(temporary_paths)
    finally:
        for path, _ in temporary_paths:
            try:
                os.unlink(path)
            except OSError:
                pass

