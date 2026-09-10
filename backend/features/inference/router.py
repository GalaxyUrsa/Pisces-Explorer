"""API route for AR NetCDF model inference."""

from __future__ import annotations

import asyncio
import shutil
import tempfile
import threading
from datetime import datetime
from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, BackgroundTasks, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse

from ...core.paths import INFERENCE_RESULTS_DIR
from ...core import compute_gate
from ...core.runtime import runtime
from ...data import load_series
from ..hub.service import get_asset, resolve_asset_file
from ..hub.manifest import read_manifest, write_manifest
from .service import run_inference


router = APIRouter(prefix="/api/inference", tags=["inference"])
SUPPORTED_MODELS = {"pisces_ocean_v5_ar"}
RESULTS_DIR = INFERENCE_RESULTS_DIR
_TASKS: dict[str, dict] = {}
_TASKS_LOCK = threading.Lock()
_INFERENCE_CONTEXT = threading.local()


def _set_task(task_key: str, **changes):
    with _TASKS_LOCK:
        _TASKS.setdefault(task_key, {}).update(changes)


def _task_progress(task_id: str, progress: int, stage: str):
    progress = max(0, min(99, int(progress)))
    _set_task(
        task_id,
        status="running",
        progress=progress,
        stage=stage,
    )
    compute_gate.update(task_id, progress, stage)


def _inference_run_dir(run_id: str) -> Path:
    if run_id != Path(run_id).name:
        raise HTTPException(status_code=400, detail="Invalid result path.")
    run_dir = (RESULTS_DIR / run_id).resolve()
    if (
        run_dir.parent != RESULTS_DIR.resolve()
        or not run_dir.is_dir()
    ):
        raise HTTPException(status_code=404, detail="Inference result not found.")
    return run_dir


def _inference_result_path(run_id: str, filename: str) -> Path:
    if filename != Path(filename).name or not filename.lower().endswith(".nc"):
        raise HTTPException(status_code=400, detail="Invalid result filename.")
    run_dir = _inference_run_dir(run_id)
    result_path = (run_dir / filename).resolve()
    if result_path.parent != run_dir or not result_path.is_file():
        raise HTTPException(status_code=404, detail="Inference result not found.")
    return result_path


def _inference_run_response(run_dir: Path) -> dict:
    outputs = sorted(run_dir.glob("prediction_*.nc"))
    if not outputs:
        raise HTTPException(status_code=404, detail="Inference result not found.")
    dates = [path.stem.removeprefix("prediction_") for path in outputs]
    completed_at_ms = int(
        max(path.stat().st_mtime for path in outputs) * 1000
    )
    manifest = read_manifest(run_dir)
    response = {
        "ok": True,
        "run_id": run_dir.name,
        "model": "pisces_ocean_v5_ar",
        "dates": dates,
        "results": [
            {
                "filename": path.name,
                "download_url": (
                    f"/api/inference/results/{run_dir.name}/{path.name}"
                ),
            }
            for path in outputs
        ],
        "saved_to": str(run_dir),
        "completed_at_ms": completed_at_ms,
    }
    if manifest:
        response.update(
            {
                "input": manifest.get("input"),
                "weights": manifest.get("weights", {}).get("filename"),
                "parameters": manifest.get("parameters", {}),
                "manifest": manifest,
            }
        )
    return response


@router.get("/results/latest")
def latest_inference_result():
    candidates = (
        sorted(
            (path for path in RESULTS_DIR.iterdir() if path.is_dir()),
            key=lambda path: path.stat().st_mtime,
            reverse=True,
        )
        if RESULTS_DIR.is_dir()
        else []
    )
    for run_dir in candidates:
        try:
            return _inference_run_response(run_dir)
        except HTTPException:
            continue
    return {"ok": False}


@router.get("/results/{run_id}/{filename}")
def download_inference_result(run_id: str, filename: str):
    result_path = _inference_result_path(run_id, filename)
    return FileResponse(
        result_path,
        media_type="application/x-netcdf",
        filename=filename,
    )


@router.post("/results/{run_id}/load")
def load_inference_result(run_id: str):
    run_dir = _inference_run_dir(run_id)
    response = _inference_run_response(run_dir)
    outputs = [
        run_dir / item["filename"] for item in response["results"]
    ]
    runtime.init_series(load_series([str(path) for path in outputs]))
    runtime.state["session_label"] = (
        f"{response['model']} · {response['dates'][0]}"
        f" → {response['dates'][-1]}"
    )
    return response


def _run_inference_task(task_id: str, task_dir: Path, parameters: dict):
    handles = []
    try:
        input_upload = None
        weights_upload = None
        if parameters["input_path"]:
            handle = Path(parameters["input_path"]).open("rb")
            handles.append(handle)
            input_upload = UploadFile(
                file=handle,
                filename=parameters["input_name"],
            )
        if parameters["weights_path"]:
            handle = Path(parameters["weights_path"]).open("rb")
            handles.append(handle)
            weights_upload = UploadFile(
                file=handle,
                filename=parameters["weights_name"],
            )
        _INFERENCE_CONTEXT.progress_callback = (
            lambda progress, stage: _task_progress(
                task_id, progress, stage
            )
        )
        _set_task(task_id, status="running", progress=2, stage="正在准备推理")
        result = asyncio.run(infer_netcdf(
            input_nc=input_upload,
            weights=weights_upload,
            input_hub_asset_id=parameters["input_hub_asset_id"],
            input_hub_member=parameters["input_hub_member"],
            weights_hub_asset_id=parameters["weights_hub_asset_id"],
            model=parameters["model"],
            steps=parameters["steps"],
            device=parameters["device"],
            start_date=parameters["start_date"],
            amp=parameters["amp"],
        ))
        compute_gate.finish(task_id)
        _set_task(
            task_id,
            status="success",
            progress=100,
            stage="推理完成",
            result=result,
        )
    except Exception as error:
        detail = error.detail if isinstance(error, HTTPException) else str(error)
        compute_gate.finish(task_id)
        _set_task(
            task_id,
            status="error",
            stage="推理失败",
            error=detail,
        )
    finally:
        if hasattr(_INFERENCE_CONTEXT, "progress_callback"):
            del _INFERENCE_CONTEXT.progress_callback
        for handle in handles:
            handle.close()
        shutil.rmtree(task_dir, ignore_errors=True)
        compute_gate.finish(task_id)


@router.post("/tasks")
async def create_inference_task(
    background_tasks: BackgroundTasks,
    input_nc: UploadFile | None = File(None),
    weights: UploadFile | None = File(None),
    input_hub_asset_id: str | None = Form(None),
    input_hub_member: str | None = Form(None),
    weights_hub_asset_id: str | None = Form(None),
    model: str = Form("pisces_ocean_v5_ar"),
    steps: int = Form(5),
    device: str = Form("cuda"),
    start_date: str | None = Form(None),
    amp: bool = Form(False),
):
    if bool(input_nc) == bool(input_hub_asset_id):
        raise HTTPException(
            status_code=400,
            detail="Choose either an uploaded input or one Hub input asset.",
        )
    if bool(weights) == bool(weights_hub_asset_id):
        raise HTTPException(
            status_code=400,
            detail="Choose either uploaded weights or one Hub model asset.",
        )
    if input_nc and not (input_nc.filename or "").lower().endswith(".nc"):
        raise HTTPException(status_code=400, detail="Input must be a .nc file.")
    if model not in SUPPORTED_MODELS:
        raise HTTPException(status_code=400, detail="Unsupported model.")
    if not 1 <= steps <= 20:
        raise HTTPException(status_code=400, detail="steps must be 1-20.")
    if device not in {"cpu", "cuda", "cuda:0"}:
        raise HTTPException(status_code=400, detail="Unsupported device.")

    task_id = uuid4().hex
    task_dir = Path(tempfile.mkdtemp(prefix="pisces_infer_task_"))
    input_path = None
    weights_path = None
    if input_nc:
        input_path = task_dir / "input.nc"
        input_path.write_bytes(await input_nc.read())
    if weights:
        weights_path = task_dir / Path(weights.filename or "weights.pth").name
        weights_path.write_bytes(await weights.read())
    if not compute_gate.begin(task_id):
        shutil.rmtree(task_dir, ignore_errors=True)
        raise HTTPException(
            status_code=423,
            detail="Another inference task is already running.",
        )
    parameters = {
        "input_path": str(input_path) if input_path else None,
        "input_name": input_nc.filename if input_nc else None,
        "weights_path": str(weights_path) if weights_path else None,
        "weights_name": weights.filename if weights else None,
        "input_hub_asset_id": input_hub_asset_id,
        "input_hub_member": input_hub_member,
        "weights_hub_asset_id": weights_hub_asset_id,
        "model": model,
        "steps": steps,
        "device": device,
        "start_date": start_date or None,
        "amp": amp,
    }
    _set_task(
        task_id,
        task_id=task_id,
        status="queued",
        progress=0,
        stage="等待执行",
    )
    background_tasks.add_task(
        _run_inference_task, task_id, task_dir, parameters
    )
    return _TASKS[task_id].copy()


@router.get("/tasks/{task_id}")
def get_inference_task(task_id: str):
    with _TASKS_LOCK:
        task = _TASKS.get(task_id)
        if task is None:
            raise HTTPException(status_code=404, detail="Inference task not found.")
        return task.copy()


@router.post("/run")
async def infer_netcdf(
    input_nc: UploadFile | None = File(None),
    weights: UploadFile | None = File(None),
    input_hub_asset_id: str | None = Form(None),
    input_hub_member: str | None = Form(None),
    weights_hub_asset_id: str | None = Form(None),
    model: str = Form("pisces_ocean_v5_ar"),
    steps: int = Form(5),
    device: str = Form("cuda"),
    start_date: str | None = Form(None),
    amp: bool = Form(False),
):
    if bool(input_nc) == bool(input_hub_asset_id):
        raise HTTPException(
            status_code=400,
            detail="Choose either an uploaded input or one Hub input asset.",
        )
    if bool(weights) == bool(weights_hub_asset_id):
        raise HTTPException(
            status_code=400,
            detail="Choose either uploaded weights or one Hub model asset.",
        )
    if input_nc and not (input_nc.filename or "").lower().endswith(".nc"):
        raise HTTPException(status_code=400, detail="Input must be a .nc file.")
    if model not in SUPPORTED_MODELS:
        raise HTTPException(status_code=400, detail="Unsupported model.")
    if not 1 <= steps <= 20:
        raise HTTPException(status_code=400, detail="steps must be 1-20.")
    if device not in {"cpu", "cuda", "cuda:0"}:
        raise HTTPException(status_code=400, detail="Unsupported device.")

    direct_task_id = None
    if not hasattr(_INFERENCE_CONTEXT, "progress_callback"):
        direct_task_id = f"direct-{uuid4().hex}"
        if not compute_gate.begin(direct_task_id):
            raise HTTPException(
                status_code=423,
                detail="Another inference task is already running.",
            )
    started_at = datetime.now().astimezone()
    work_dir = Path(tempfile.mkdtemp(prefix="pisces_infer_"))
    input_path = work_dir / "input.nc"
    weights_path = None
    run_id = f"{datetime.now():%Y%m%d_%H%M%S}_{uuid4().hex[:8]}"
    output_dir = RESULTS_DIR / run_id
    completed = False
    try:
        if input_nc:
            input_path.write_bytes(await input_nc.read())
            input_name = input_nc.filename
        else:
            input_asset = get_asset(input_hub_asset_id)
            if input_asset is None:
                raise HTTPException(
                    status_code=404, detail="Hub input asset not found."
                )
            try:
                input_path = resolve_asset_file(
                    input_asset,
                    member=input_hub_member,
                    asset_type="netcdf",
                )
            except ValueError as error:
                raise HTTPException(
                    status_code=400, detail=str(error)
                ) from error
            input_name = input_path.name

        if weights:
            weights_path = (
                work_dir / Path(weights.filename or "weights.pth").name
            )
            weights_path.write_bytes(await weights.read())
            weights_name = weights.filename
        else:
            weights_asset = get_asset(weights_hub_asset_id)
            if weights_asset is None:
                raise HTTPException(
                    status_code=404, detail="Hub model asset not found."
                )
            try:
                weights_path = resolve_asset_file(
                    weights_asset,
                    asset_type="model",
                )
            except ValueError as error:
                raise HTTPException(
                    status_code=400, detail=str(error)
                ) from error
            weights_name = weights_path.name
        RESULTS_DIR.mkdir(parents=True, exist_ok=True)
        outputs = run_inference(
            weights_path,
            input_path,
            output_dir,
            steps=steps,
            device_name=device,
            start_date=start_date or None,
            use_amp=amp,
            progress_callback=getattr(
                _INFERENCE_CONTEXT, "progress_callback", None
            ),
        )
        if getattr(_INFERENCE_CONTEXT, "progress_callback", None):
            _INFERENCE_CONTEXT.progress_callback(95, "正在整理推理结果")
        runtime.init_series(load_series([str(path) for path in outputs]))
        dates = runtime.state["series_dates"]
        runtime.state["session_label"] = (
            f"{model} · {dates[0]} → {dates[-1]}"
        )
        result_files = [
            {
                "filename": path.name,
                "download_url": (
                    f"/api/inference/results/{run_id}/{path.name}"
                ),
            }
            for path in outputs
        ]
        parameters = {
            "model": model,
            "steps": steps,
            "device": device,
            "start_date": start_date or None,
            "amp": amp,
        }
        completed_at = datetime.now().astimezone()
        write_manifest(
            output_dir,
            {
                "schema_version": 1,
                "run_id": run_id,
                "task_type": "inference",
                "status": "completed",
                "created_at": started_at.isoformat(timespec="seconds"),
                "completed_at": completed_at.isoformat(timespec="seconds"),
                "input": {
                    "source": "hub" if input_hub_asset_id else "upload",
                    "asset_id": input_hub_asset_id,
                    "member": input_hub_member,
                    "filename": input_name,
                },
                "weights": {
                    "source": "hub" if weights_hub_asset_id else "upload",
                    "asset_id": weights_hub_asset_id,
                    "filename": weights_name,
                },
                "parameters": parameters,
                "dates": dates,
                "outputs": [
                    {"filename": item["filename"], "type": "netcdf"}
                    for item in result_files
                ],
                "error": None,
            },
        )
        completed = True
        return {
            "ok": True,
            "run_id": run_id,
            "model": model,
            "weights": weights_name,
            "input": input_name,
            "dates": dates,
            "device": device,
            "steps": steps,
            "parameters": parameters,
            "results": result_files,
            "saved_to": str(output_dir),
            "completed_at_ms": int(
                max(path.stat().st_mtime for path in outputs) * 1000
            ),
        }
    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(
            status_code=422, detail=f"Inference failed: {error}"
        ) from error
    finally:
        shutil.rmtree(work_dir, ignore_errors=True)
        if not completed:
            shutil.rmtree(output_dir, ignore_errors=True)
        if direct_task_id:
            compute_gate.finish(direct_task_id)
