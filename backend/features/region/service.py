"""Research-area validation and fixed-size center calculations."""

from __future__ import annotations

import math

EARTH_RADIUS_KM = 6371.0088
FIXED_SIDE_KM = 240.0


def _validate_bounds(bounds) -> list[float]:
    if not isinstance(bounds, list) or len(bounds) != 4:
        raise ValueError("bounds must be [lon_min, lon_max, lat_min, lat_max]")
    values = [float(value) for value in bounds]
    lon_min, lon_max, lat_min, lat_max = values
    if not all(math.isfinite(value) for value in values):
        raise ValueError("区域边界必须是有效数字")
    if not (-180 <= lon_min < lon_max <= 180):
        raise ValueError("经度边界必须在 -180° 至 180° 内递增")
    if not (-90 <= lat_min < lat_max <= 90):
        raise ValueError("纬度边界必须在 -90° 至 90° 内递增")
    return values


def _size_km(bounds: list[float]) -> tuple[float, float]:
    lon_min, lon_max, lat_min, lat_max = bounds
    center_lat = math.radians((lat_min + lat_max) / 2)
    height = EARTH_RADIUS_KM * math.radians(lat_max - lat_min)
    width = (
        EARTH_RADIUS_KM
        * math.cos(center_lat)
        * math.radians(lon_max - lon_min)
    )
    return abs(width), abs(height)


def selection_from_payload(payload: dict) -> dict:
    mode = payload.get("mode")
    if mode == "center":
        lat = float(payload.get("lat"))
        lon = float(payload.get("lon"))
        if not math.isfinite(lat) or not math.isfinite(lon):
            raise ValueError("中心经纬度必须是有效数字")
        if not -88 <= lat <= 88 or not -180 <= lon <= 180:
            raise ValueError("中心点必须位于纬度 ±88°、经度 ±180° 范围内")
        half_angle = (FIXED_SIDE_KM / 2) / EARTH_RADIUS_KM
        lat_delta = math.degrees(half_angle)
        lon_delta = math.degrees(half_angle / math.cos(math.radians(lat)))
        bounds = [lon - lon_delta, lon + lon_delta, lat - lat_delta, lat + lat_delta]
        if bounds[0] < -180 or bounds[1] > 180:
            raise ValueError("第一版暂不支持跨越国际日期变更线的区域")
        bounds = _validate_bounds(bounds)
        fixed = True
    elif mode == "bounds":
        bounds = _validate_bounds(payload.get("bounds"))
        lon = (bounds[0] + bounds[1]) / 2
        lat = (bounds[2] + bounds[3]) / 2
        fixed = False
    else:
        raise ValueError("mode must be center or bounds")

    width, height = _size_km(bounds)
    if width <= 0 or height <= 0:
        raise ValueError("区域范围过小")
    return {
        "mode": mode,
        "center": {"lon": lon, "lat": lat},
        "bounds": bounds,
        "width_km": width,
        "height_km": height,
        "fixed_size": fixed,
    }
