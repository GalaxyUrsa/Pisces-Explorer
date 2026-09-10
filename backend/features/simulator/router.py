"""API route for idealized ocean-phenomenon simulation."""

from __future__ import annotations

import os
import re
import shutil
import tempfile
from datetime import datetime
from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse

from ...core.paths import SIMULATOR_RESULTS_DIR
from ...core.runtime import runtime
from ...data import load_from_path
from ..hub.service import get_asset, resolve_asset_file
from ..hub.manifest import read_manifest, write_manifest
from .preview import make_surface_current_preview
from .service import simulate_eddy


router = APIRouter(prefix="/api/simulator", tags=["simulator"])
RESULTS_DIR = SIMULATOR_RESULTS_DIR


def _simulation_result_path(filename: str) -> Path:
    if filename != Path(filename).name or not filename.lower().endswith(".nc"):
        raise HTTPException(status_code=400, detail="Invalid result filename.")
    candidates = [RESULTS_DIR / filename]
    if RESULTS_DIR.is_dir():
        candidates.extend(RESULTS_DIR.glob(f"*/{filename}"))
    root = RESULTS_DIR.resolve()
    for candidate in candidates:
        result_path = candidate.resolve()
        if (
            result_path.is_relative_to(root)
            and result_path.is_file()
            and result_path.suffix.lower() == ".nc"
        ):
            return result_path
    raise HTTPException(status_code=404, detail="Simulation result not found.")


def _simulation_result_response(result_path: Path) -> dict:
    manifest = (
        read_manifest(result_path.parent)
        if result_path.parent != RESULTS_DIR.resolve()
        else None
    )
    response = {
        "ok": True,
        "phenomenon": "idealized_eddy",
        "filename": result_path.name,
        "download_url": f"/api/simulator/results/{result_path.name}",
        "saved_to": str(result_path),
        "completed_at_ms": int(result_path.stat().st_mtime * 1000),
    }
    if manifest:
        response.update(
            {
                "run_id": manifest.get("run_id"),
                "input": manifest.get("input"),
                "parameters": manifest.get("parameters", {}),
                "manifest": manifest,
            }
        )
    return response


def _simulation_candidates() -> list[Path]:
    if not RESULTS_DIR.is_dir():
        return []
    candidates = list(RESULTS_DIR.glob("*.nc"))
    candidates.extend(RESULTS_DIR.glob("*/*.nc"))
    return candidates


@router.get("/results/latest")
def latest_simulation_result():
    candidates = sorted(
        _simulation_candidates(),
        key=lambda path: path.stat().st_mtime,
        reverse=True,
    )
    return (
        _simulation_result_response(candidates[0])
        if candidates
        else {"ok": False}
    )


@router.get("/results/{filename}")
def download_simulation_result(filename: str):
    result_path = _simulation_result_path(filename)
    return FileResponse(
        result_path,
        media_type="application/x-netcdf",
        filename=filename,
    )


@router.post("/results/{filename}/load")
def load_simulation_result(filename: str):
    result_path = _simulation_result_path(filename)
    runtime.init_state(load_from_path(result_path))
    runtime.state["session_label"] = result_path.name
    return _simulation_result_response(result_path)


@router.post("/preview")
async def preview_simulator_background(
    file: UploadFile | None = File(None),
    hub_asset_id: str | None = Form(None),
    hub_member: str | None = Form(None),
):
    if bool(file) == bool(hub_asset_id):
        raise HTTPException(
            status_code=400,
            detail="Choose either an uploaded file or one Hub asset.",
        )
    if file and not (file.filename or "").lower().endswith(".nc"):
        raise HTTPException(
            status_code=400, detail="Only .nc files are supported."
        )

    input_path = None
    temporary_input = False
    try:
        if file:
            with tempfile.NamedTemporaryFile(
                delete=False, suffix=".nc"
            ) as source:
                source.write(await file.read())
                input_path = Path(source.name)
                temporary_input = True
        else:
            asset = get_asset(hub_asset_id)
            if asset is None:
                raise HTTPException(
                    status_code=404, detail="Hub asset not found."
                )
            try:
                input_path = resolve_asset_file(
                    asset,
                    member=hub_member,
                    asset_type="netcdf",
                )
            except ValueError as error:
                raise HTTPException(
                    status_code=400, detail=str(error)
                ) from error
        return make_surface_current_preview(input_path)
    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(
            status_code=422,
            detail=f"Preview failed: {error}",
        ) from error
    finally:
        if input_path and temporary_input:
            try:
                os.unlink(input_path)
            except OSError:
                pass


@router.post("/eddy")
async def simulate_idealized_eddy(
    file: UploadFile | None = File(None),
    hub_asset_id: str | None = Form(None),
    hub_member: str | None = Form(None),
    longitude: float = Form(...),
    latitude: float = Form(...),
    radius_km: float = Form(...),
    amplitude_cm: float = Form(...),
    influence_depth_m: float = Form(...),
    kind: str = Form("gaussian"),
    vertical_decay: str = Form("exponential"),
):
    if bool(file) == bool(hub_asset_id):
        raise HTTPException(
            status_code=400,
            detail="Choose either an uploaded file or one Hub asset.",
        )
    if file and not (file.filename or "").lower().endswith(".nc"):
        raise HTTPException(status_code=400, detail="Only .nc files are supported.")
    if not 50 <= radius_km <= 100:
        raise HTTPException(status_code=400, detail="radius_km must be 50-100.")
    if kind not in {"gaussian", "rankine"}:
        raise HTTPException(status_code=400, detail="Unsupported eddy kind.")
    if vertical_decay not in {"exponential", "gaussian"}:
        raise HTTPException(status_code=400, detail="Unsupported vertical decay.")

    input_path = output_path = output_dir = None
    temporary_input = False
    completed = False
    try:
        if file:
            with tempfile.NamedTemporaryFile(
                delete=False, suffix=".nc"
            ) as source:
                source.write(await file.read())
                input_path = Path(source.name)
                temporary_input = True
            input_name = file.filename or "background.nc"
        else:
            asset = get_asset(hub_asset_id)
            if asset is None:
                raise HTTPException(
                    status_code=404, detail="Hub asset not found."
                )
            try:
                input_path = resolve_asset_file(
                    asset,
                    member=hub_member,
                    asset_type="netcdf",
                )
            except ValueError as error:
                raise HTTPException(
                    status_code=400, detail=str(error)
                ) from error
            input_name = input_path.name
        safe_stem = re.sub(
            r"[^A-Za-z0-9_-]+", "_", Path(input_name).stem
        ).strip("_") or "background"
        now = datetime.now().astimezone()
        timestamp = now.strftime("%Y%m%d_%H%M%S")
        run_id = f"{timestamp}_{uuid4().hex[:8]}"
        result_filename = (
            f"simulated_eddy_{safe_stem}_{run_id}.nc"
        )
        RESULTS_DIR.mkdir(parents=True, exist_ok=True)
        output_dir = RESULTS_DIR / run_id
        output_dir.mkdir()
        output_path = output_dir / result_filename
        simulate_eddy(
            input_path,
            output_path,
            longitude=longitude,
            latitude=latitude,
            radius_km=radius_km,
            amplitude_cm=amplitude_cm,
            influence_depth_m=influence_depth_m,
            kind=kind,
            vertical_decay=vertical_decay,
        )
        runtime.init_state(load_from_path(output_path))
        runtime.state["session_label"] = result_filename
        parameters = {
            "phenomenon": "idealized_eddy",
            "longitude": longitude,
            "latitude": latitude,
            "radius_km": radius_km,
            "amplitude_cm": amplitude_cm,
            "influence_depth_m": influence_depth_m,
            "kind": kind,
            "vertical_decay": vertical_decay,
        }
        write_manifest(
            output_dir,
            {
                "schema_version": 1,
                "run_id": run_id,
                "task_type": "simulator",
                "status": "completed",
                "created_at": now.isoformat(timespec="seconds"),
                "completed_at": datetime.now().astimezone().isoformat(
                    timespec="seconds"
                ),
                "input": {
                    "source": "hub" if hub_asset_id else "upload",
                    "asset_id": hub_asset_id,
                    "member": hub_member,
                    "filename": input_name,
                },
                "parameters": parameters,
                "outputs": [
                    {"filename": result_filename, "type": "netcdf"}
                ],
                "error": None,
            },
        )
        completed = True
        return _simulation_result_response(output_path)
    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(
            status_code=422, detail=f"Simulation failed: {error}"
        ) from error
    finally:
        if input_path and temporary_input:
            try:
                os.unlink(input_path)
            except OSError:
                pass
        if output_dir and not completed:
            shutil.rmtree(output_dir, ignore_errors=True)
