"""Unified history APIs for Pisces-Hub assets."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

from ...core.runtime import runtime
from ...data import load_from_path, load_series
from .service import delete_asset, get_asset, list_assets, resolve_asset_file


router = APIRouter(prefix="/api/hub", tags=["hub"])


def _find_asset(asset_id: str) -> dict:
    asset = get_asset(asset_id)
    if asset is None:
        raise HTTPException(status_code=404, detail="Hub asset not found.")
    return asset


@router.get("/assets")
def hub_assets(
    asset_type: str | None = Query(None, pattern="^(netcdf|model)$"),
    source: str | None = None,
):
    assets = list_assets()
    if asset_type:
        assets = [
            asset for asset in assets if asset["asset_type"] == asset_type
        ]
    if source:
        assets = [asset for asset in assets if asset["source"] == source]
    return {"assets": assets}


@router.get("/assets/{asset_id}")
def hub_asset(asset_id: str):
    return _find_asset(asset_id)


@router.post("/assets/{asset_id}/load")
def load_hub_asset(asset_id: str, member: str | None = None):
    asset = _find_asset(asset_id)
    if asset["asset_type"] != "netcdf":
        raise HTTPException(
            status_code=400,
            detail="Only NetCDF assets can be loaded into Explorer.",
        )
    try:
        if asset["kind"] == "series" and not member:
            paths = [
                resolve_asset_file(asset, member=item["filename"])
                for item in asset["files"]
            ]
            runtime.init_series(load_series([str(path) for path in paths]))
        else:
            path = resolve_asset_file(
                asset,
                member=member,
                asset_type="netcdf",
            )
            runtime.init_state(load_from_path(path))
        runtime.state["session_label"] = (
            member or asset.get("filename") or asset["name"]
        )
    except (OSError, ValueError, RuntimeError, KeyError) as error:
        raise HTTPException(
            status_code=422,
            detail=f"Failed to load Hub asset: {error}",
        ) from error
    return {"ok": True, "asset": asset, "member": member}


@router.delete("/assets/{asset_id}")
def remove_hub_asset(asset_id: str):
    asset = _find_asset(asset_id)
    try:
        delete_asset(asset)
    except OSError as error:
        raise HTTPException(
            status_code=409,
            detail=f"Failed to delete Hub asset: {error}",
        ) from error
    return {"ok": True, "deleted": asset}
