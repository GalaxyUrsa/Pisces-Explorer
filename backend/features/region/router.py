"""Region-selection endpoints for the independent Region workspace."""

from fastapi import APIRouter, HTTPException

from ...core.runtime import region_runtime
from .service import selection_from_payload


router = APIRouter(prefix="/region/api", tags=["region"])


@router.get("/selection")
def get_selection():
    return {
        "ready": bool(region_runtime.state.get("region_selection")),
        "selection": region_runtime.state.get("region_selection"),
        "data_ready": region_runtime.ready,
    }


@router.put("/selection")
def put_selection(payload: dict):
    if region_runtime.ready:
        raise HTTPException(
            status_code=409,
            detail="更换区域前请先清空当前 Region 数据",
        )
    try:
        selection = selection_from_payload(payload)
    except (TypeError, ValueError) as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    region_runtime.state["region_selection"] = selection
    return {"ok": True, "selection": selection}
