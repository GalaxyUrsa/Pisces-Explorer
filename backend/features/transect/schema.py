"""Request schemas for the two-point transect feature."""

from __future__ import annotations

from typing import Optional

from pydantic import BaseModel


class Point(BaseModel):
    lat: float
    lon: float


class TransectRequest(BaseModel):
    p1: Point
    p2: Point
    depth_idx: int
    variable: str = "ss"
    depth_range: Optional[list] = None
    value_range: Optional[list] = None
    date_idx: int = 0
    comparison_source: str = "a"

