"""Request schema for the point-profile feature."""

from __future__ import annotations

from typing import Optional

from pydantic import BaseModel


class ProfileRequest(BaseModel):
    lat: float
    lon: float
    depth_idx: int
    variable: str = "ss"
    depth_range: Optional[list] = None
    value_range: Optional[list] = None
    date_idx: int = 0
    comparison_source: str = "a"
    region: Optional[list[float]] = None
