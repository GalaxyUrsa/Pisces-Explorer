"""Pisces-Explorer FastAPI application assembly.

Business routes live under ``backend.features``. This module only composes
registered feature routers and serves the frontend.
"""

from __future__ import annotations

import importlib
import os
import sys

from fastapi import FastAPI, Request
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from .core.feature_registry import FEATURE_REGISTRY
from .core.compute_gate import active as active_compute_task
from .core.runtime import reset_runtime_scope, runtime, set_runtime_scope


def create_app() -> FastAPI:
    application = FastAPI(title="Pisces-Explorer API")
    for feature in FEATURE_REGISTRY.values():
        module = importlib.import_module(feature.router_module)
        application.include_router(module.router)
        if feature.key in {
            "dataset", "volume", "layer", "profile", "transect", "comparison"
        }:
            application.include_router(module.router, prefix="/region")

    region_module = importlib.import_module("backend.features.region.router")
    application.include_router(region_module.router)

    frontend = _get_frontend_dir()
    application.mount(
        "/static", StaticFiles(directory=frontend), name="static"
    )

    @application.middleware("http")
    async def no_cache_static(request: Request, call_next):
        token = set_runtime_scope(
            "region" if request.url.path.startswith("/region/api") else "explorer"
        )
        try:
            compute_task = active_compute_task()
            progress_request = (
                request.method == "GET"
                and request.url.path.startswith("/api/inference/tasks/")
            )
            if (
                compute_task
                and (request.url.path.startswith("/api/")
                     or request.url.path.startswith("/region/api/"))
                and not progress_request
            ):
                return JSONResponse(
                    status_code=423,
                    content={
                        "detail": "模型推理正在运行，其他操作暂时锁定。",
                        **compute_task,
                    },
                )
            response = await call_next(request)
            if request.url.path.startswith("/static/"):
                response.headers["Cache-Control"] = "no-store"
            return response
        finally:
            reset_runtime_scope(token)

    @application.get("/")
    def index():
        return FileResponse(
            _frontend_page(frontend, "explorer", fallback="index"),
            headers={"Cache-Control": "no-store"},
        )

    @application.get("/simulator")
    def simulator_page():
        return FileResponse(
            _workflow_page(frontend, "simulator"),
            headers={"Cache-Control": "no-store"},
        )

    @application.get("/inference")
    def inference_page():
        return FileResponse(
            _workflow_page(frontend, "inference"),
            headers={"Cache-Control": "no-store"},
        )

    @application.get("/region")
    def region_page():
        return FileResponse(
            _frontend_page(frontend, "region"),
            headers={"Cache-Control": "no-store"},
        )

    return application


def _workflow_page(frontend: str, name: str) -> str:
    """Prefer the built Vue page while keeping source-tree compatibility."""
    return _frontend_page(frontend, name)


def _frontend_page(frontend: str, name: str, fallback: str | None = None) -> str:
    """Resolve one built Vue page with a legacy HTML fallback."""
    built = os.path.join(frontend, "vue-dist", f"{name}.html")
    if os.path.isfile(built):
        return built
    return os.path.join(frontend, "pages", f"{fallback or name}.html")


def _get_frontend_dir() -> str:
    if getattr(sys, "frozen", False):
        return os.path.join(sys._MEIPASS, "frontend")
    return os.path.join(os.path.dirname(__file__), "..", "frontend")


def init_data(nc_dir: str, date_str: str):
    """Compatibility entry point used by ``run.py``."""
    runtime.init_from_directory(nc_dir, date_str)


app = create_app()
