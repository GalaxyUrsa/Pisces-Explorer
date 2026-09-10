"""One-kilometre display-grid interpolation for Region layer maps."""

from __future__ import annotations

import math

import numpy as np

from ...core.spatial import parse_region
from ...core.variables import get_variable

EARTH_RADIUS_KM = 6371.0088
DISPLAY_RESOLUTION_KM = 1.0


def json_safe(value):
    """Replace non-finite values in a Region response with JSON null."""
    if isinstance(value, dict):
        return {key: json_safe(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [json_safe(item) for item in value]
    if isinstance(value, np.ndarray):
        return json_safe(value.tolist())
    if isinstance(value, (float, np.floating)) and not np.isfinite(value):
        return None
    return value


def display_grid(bounds) -> tuple[np.ndarray, np.ndarray]:
    """Return a full-coverage grid with spacing no greater than 1 km."""
    lon_min, lon_max, lat_min, lat_max = parse_region(bounds)
    center_lat = math.radians((lat_min + lat_max) / 2)
    height_km = EARTH_RADIUS_KM * math.radians(lat_max - lat_min)
    width_km = EARTH_RADIUS_KM * math.cos(center_lat) * math.radians(lon_max - lon_min)
    # Avoid an extra cell when a nominal 240 km selection differs only by
    # floating-point round-off from an exact kilometre boundary.
    lat_segments = max(1, math.ceil(height_km / DISPLAY_RESOLUTION_KM - 1e-9))
    lon_segments = max(1, math.ceil(width_km / DISPLAY_RESOLUTION_KM - 1e-9))
    lat_count, lon_count = lat_segments + 1, lon_segments + 1
    return np.linspace(lat_min, lat_max, lat_count), np.linspace(lon_min, lon_max, lon_count)


def bilinear(values, source_lats, source_lons, target_lats, target_lons):
    """Interpolate a rectilinear field without bridging NaN source cells."""
    data = np.asarray(values, dtype=float)
    lats = np.asarray(source_lats, dtype=float)
    lons = np.asarray(source_lons, dtype=float)
    if data.shape != (len(lats), len(lons)):
        raise ValueError("layer shape does not match latitude/longitude coordinates")
    if len(lats) < 2 or len(lons) < 2:
        raise ValueError("at least 2 × 2 source grid points are required")
    if lats[0] > lats[-1]:
        lats, data = lats[::-1], data[::-1, :]
    if lons[0] > lons[-1]:
        lons, data = lons[::-1], data[:, ::-1]
    if np.any(np.diff(lats) <= 0) or np.any(np.diff(lons) <= 0):
        raise ValueError("latitude and longitude coordinates must be monotonic")

    lat_grid, lon_grid = np.meshgrid(target_lats, target_lons, indexing="ij")
    lat_hi = np.searchsorted(lats, lat_grid, side="right")
    lon_hi = np.searchsorted(lons, lon_grid, side="right")
    valid = ((lat_grid >= lats[0]) & (lat_grid <= lats[-1])
             & (lon_grid >= lons[0]) & (lon_grid <= lons[-1]))
    lat_hi = np.clip(lat_hi, 1, len(lats) - 1)
    lon_hi = np.clip(lon_hi, 1, len(lons) - 1)
    lat_lo, lon_lo = lat_hi - 1, lon_hi - 1
    wy = (lat_grid - lats[lat_lo]) / (lats[lat_hi] - lats[lat_lo])
    wx = (lon_grid - lons[lon_lo]) / (lons[lon_hi] - lons[lon_lo])
    corners = (data[lat_lo, lon_lo], data[lat_lo, lon_hi],
               data[lat_hi, lon_lo], data[lat_hi, lon_hi])
    valid &= np.logical_and.reduce([np.isfinite(value) for value in corners])
    result = (corners[0] * (1 - wy) * (1 - wx)
              + corners[1] * (1 - wy) * wx
              + corners[2] * wy * (1 - wx)
              + corners[3] * wy * wx)
    return np.where(valid, result, np.nan)


def _source_layer(values, depth_idx: int, is_2d: bool):
    array = np.asarray(values)
    return array if is_2d else array[depth_idx]


def _array_identity(value) -> int:
    array = np.asarray(value)
    while isinstance(array.base, np.ndarray):
        array = array.base
    return id(array)


def region_display_layer(runtime, frame, variable, depth_idx, is_2d, bounds):
    """Return interpolated scalar/components and coordinates for one layer."""
    target_lats, target_lons = display_grid(bounds)
    cache = runtime.state.get("region_layer_cache")
    if cache is None:
        cache = {}
        runtime.state["region_layer_cache"] = cache
    key = (_array_identity(frame["ss"]), variable,
           0 if is_2d else depth_idx, tuple(map(float, parse_region(bounds))))
    if key in cache:
        return cache[key]

    spec = get_variable(variable)
    components = None
    if spec.components:
        first = bilinear(_source_layer(frame[spec.components[0]], depth_idx, is_2d),
                         frame["lats"], frame["lons"], target_lats, target_lons)
        second = bilinear(_source_layer(frame[spec.components[1]], depth_idx, is_2d),
                          frame["lats"], frame["lons"], target_lats, target_lons)
        components = (first, second)
        scalar = ((90 - np.degrees(np.arctan2(second, first))) % 360
                  if variable == "mwd" else np.hypot(first, second))
    else:
        raw = _source_layer(runtime.get_scalar_data(variable, frame), depth_idx, is_2d)
        scalar = bilinear(raw, frame["lats"], frame["lons"], target_lats, target_lons)
    result = {"scalar": scalar, "components": components,
              "lats": target_lats, "lons": target_lons}
    if len(cache) >= 128:
        cache.clear()
    cache[key] = result
    return result
