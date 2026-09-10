"""Spatial-region validation and non-destructive frame cropping."""

from __future__ import annotations

import json

import numpy as np


def parse_region(value) -> list[float] | None:
    if value is None:
        return None
    region = json.loads(value) if isinstance(value, str) else value
    if not isinstance(region, list) or len(region) != 4:
        raise ValueError("region must be [lon_min, lon_max, lat_min, lat_max]")
    bounds = list(map(float, region))
    lon_min, lon_max, lat_min, lat_max = bounds
    if not all(np.isfinite(bounds)) or lon_min >= lon_max or lat_min >= lat_max:
        raise ValueError("region boundaries must be finite and increasing")
    return bounds


def crop_frame(frame: dict, region) -> dict:
    bounds = parse_region(region)
    if bounds is None:
        return frame
    lon_min, lon_max, lat_min, lat_max = bounds
    lats = np.asarray(frame["lats"])
    lons = np.asarray(frame["lons"])
    lat_indices = np.flatnonzero((lats >= lat_min) & (lats <= lat_max))
    lon_indices = np.flatnonzero((lons >= lon_min) & (lons <= lon_max))
    if len(lat_indices) < 2 or len(lon_indices) < 2:
        raise ValueError("region must contain at least 2 × 2 grid points")
    lat_slice = slice(lat_indices[0], lat_indices[-1] + 1)
    lon_slice = slice(lon_indices[0], lon_indices[-1] + 1)
    cropped = dict(frame)
    for key, value in frame.items():
        if not isinstance(value, np.ndarray) or value.ndim < 2:
            continue
        if value.shape[-2:] == (len(lats), len(lons)):
            cropped[key] = value[..., lat_slice, lon_slice]
    cropped["lats"] = lats[lat_slice]
    cropped["lons"] = lons[lon_slice]
    return cropped


def point_in_region(lat: float, lon: float, region) -> bool:
    bounds = parse_region(region)
    if bounds is None:
        return True
    lon_min, lon_max, lat_min, lat_max = bounds
    return lon_min <= lon <= lon_max and lat_min <= lat <= lat_max
