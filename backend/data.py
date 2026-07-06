"""
Data loading and sound speed calculation.
"""

import os
import re
import numpy as np
import xarray as xr


def sound_speed_chen_millero(T, S, z):
    """UNESCO / Chen-Millero (1977) sound speed formula."""
    P = z * 0.1  # dbar
    Cw = (
        (1402.388
         + 5.03830 * T - 5.81090e-2 * T**2 + 3.3432e-4 * T**3
         - 1.47797e-6 * T**4 + 3.1419e-9 * T**5)
        + P * (0.153563 + 6.8999e-4 * T - 8.1829e-6 * T**2
               + 1.3632e-7 * T**3 - 6.1260e-10 * T**4)
        + P**2 * (3.1260e-5 - 1.7111e-6 * T + 2.5986e-8 * T**2
                  - 2.5353e-10 * T**3 + 1.0415e-12 * T**4)
        + P**3 * (-9.7729e-9 + 3.8513e-10 * T - 2.3654e-12 * T**2)
    )
    A = (
        (1.389 - 1.262e-2 * T + 7.166e-5 * T**2
         + 2.008e-6 * T**3 - 3.21e-8 * T**4)
        + P * (9.4742e-5 - 1.2583e-5 * T - 6.4928e-8 * T**2
               + 1.0515e-8 * T**3 - 2.0142e-10 * T**4)
        + P**2 * (-3.9064e-7 + 9.1061e-9 * T - 1.6009e-10 * T**2
                  + 7.994e-12 * T**3)
        + P**3 * (1.100e-10 + 6.651e-12 * T - 3.391e-13 * T**2)
    )
    B = -1.922e-2 - 4.42e-5 * T + P * 7.3637e-5 + P * T * 1.7950e-7
    D = 1.727e-3 - 7.9836e-6 * P
    S_nn = np.where(S >= 0, S, np.nan)  # S**1.5 is undefined for negative S
    return Cw + A * S_nn + B * S_nn**1.5 + D * S_nn**2


DEPTHS = np.array([
    0.5, 9.6, 18.5, 29.4, 40.3, 55.8, 65.8, 77.9, 92.3, 109.7,
    130.7, 155.9, 186.1, 222.5, 266.0, 318.1, 380.2, 453.9, 541.1, 643.6
])


def _load_nc(ds) -> tuple:
    """Extract T, S, lats, lons, depths from an open xarray Dataset."""
    T    = ds["thetao"].isel(time=0).values
    S    = ds["so"].isel(time=0).values
    lats = ds["latitude"].values
    lons = ds["longitude"].values
    for dim in ("depth", "deptht", "lev", "level", "z_l", "z_t"):
        if dim in ds.coords or dim in ds.dims:
            depths = ds[dim].values.astype(float)
            break
    else:
        depths = DEPTHS
    return T, S, lats, lons, depths


def _load_optional_3d(ds, name, shape_3d):
    """Load a 3D variable if present, else return NaN array."""
    if name in ds:
        return ds[name].isel(time=0).values.astype(float)
    return np.full(shape_3d, np.nan)


def _load_optional_2d(ds, name, shape_2d):
    """Load a 2D variable if present, else return NaN array."""
    if name in ds:
        arr = ds[name].isel(time=0).values.astype(float)
        return arr
    return np.full(shape_2d, np.nan)


def _compute_ss(T, S, depths):
    z = depths[:, np.newaxis, np.newaxis] * np.ones_like(T)
    return sound_speed_chen_millero(T, S, z)


def load_sound_speed(nc_dir: str, date_str: str):
    pred_path = os.path.join(nc_dir, f"prediction_{date_str}.nc")
    if not os.path.exists(pred_path):
        raise FileNotFoundError(f"Not found: {pred_path}")
    return load_from_path(pred_path)


def load_from_path(path: str) -> dict:
    """Load from an arbitrary .nc file path. Returns a dict of all variables."""
    ds = xr.open_dataset(path)
    T, S, lats, lons, depths = _load_nc(ds)
    shape_3d = T.shape
    shape_2d = (len(lats), len(lons))
    ss = _compute_ss(T, S, depths)
    result = {
        "ss":    ss,
        "temp":  T,
        "salt":  S,
        "uo":    _load_optional_3d(ds, "uo",    shape_3d),
        "vo":    _load_optional_3d(ds, "vo",    shape_3d),
        "u10":   _load_optional_2d(ds, "u10",   shape_2d),
        "v10":   _load_optional_2d(ds, "v10",   shape_2d),
        "swh":   _load_optional_2d(ds, "swh",   shape_2d),
        "mwd_u": _load_optional_2d(ds, "mwd_u", shape_2d),
        "mwd_v": _load_optional_2d(ds, "mwd_v", shape_2d),
        "lats":   lats,
        "lons":   lons,
        "depths": depths,
    }
    ds.close()
    return result


def nearest_idx(arr, val):
    return int(np.argmin(np.abs(arr - val)))


def load_series(items: list) -> list[dict]:
    """Load multiple NC files. items can be file paths or (path, display_name) tuples."""
    frames = []
    for item in items:
        if isinstance(item, tuple):
            path, display_name = item
        else:
            path, display_name = item, item
        date_match = re.search(r'(\d{8})', os.path.basename(display_name))
        if not date_match:
            raise ValueError(f"No date found in filename: {display_name}")
        date_str = date_match.group(1)
        try:
            frame = load_from_path(path)
            frame["date"] = date_str
            frames.append(frame)
        except Exception as e:
            raise RuntimeError(f"Failed to load {display_name}: {e}") from e
    return frames
