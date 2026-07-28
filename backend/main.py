"""Pisces-Explorer FastAPI application assembly.

Business routes live under ``backend.features``. This module only composes
registered feature routers and serves the frontend.
"""

from __future__ import annotations

import importlib
import os
import sys

from fastapi import FastAPI, Request
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from .core.feature_registry import FEATURE_REGISTRY
from .core.runtime import runtime


def create_app() -> FastAPI:
    application = FastAPI(title="Pisces-Explorer API")
    for feature in FEATURE_REGISTRY.values():
        module = importlib.import_module(feature.router_module)
        application.include_router(module.router)

    frontend = _get_frontend_dir()
    application.mount(
        "/static", StaticFiles(directory=frontend), name="static"
    )

    @application.middleware("http")
    async def no_cache_static(request: Request, call_next):
        response = await call_next(request)
        if request.url.path.startswith("/static/"):
            response.headers["Cache-Control"] = "no-store"
        return response

    @application.get("/")
    def index():
        return FileResponse(
            os.path.join(frontend, "index.html"),
            headers={"Cache-Control": "no-store"},
        )

    return application


def _get_frontend_dir() -> str:
    if getattr(sys, "frozen", False):
        return os.path.join(sys._MEIPASS, "frontend")
    return os.path.join(os.path.dirname(__file__), "..", "frontend")


def init_data(nc_dir: str, date_str: str):
    """Compatibility entry point used by ``run.py``."""
    runtime.init_from_directory(nc_dir, date_str)


app = create_app()
