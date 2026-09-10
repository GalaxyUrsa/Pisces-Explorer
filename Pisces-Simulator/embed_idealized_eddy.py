#!/usr/bin/env python3
"""Embed an idealized, geostrophically balanced eddy in a GLORYS NetCDF file."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
import xarray as xr

EARTH_RADIUS = 6_371_000.0
OMEGA = 7.2921159e-5
GRAVITY = 9.81


def _metric_offsets(lon: xr.DataArray, lat: xr.DataArray, lon0: float, lat0: float):
    """Local east/north distances (m), with longitude wrapping at the dateline."""
    lon2d, lat2d = xr.broadcast(lon, lat)
    lon2d = lon2d.transpose(lat.dims[0], lon.dims[0])
    lat2d = lat2d.transpose(lat.dims[0], lon.dims[0])
    dlon = (lon2d - lon0 + 180.0) % 360.0 - 180.0
    x = EARTH_RADIUS * np.deg2rad(dlon) * np.cos(np.deg2rad(lat2d))
    y = EARTH_RADIUS * np.deg2rad(lat2d - lat0)
    return x, y


def ssh_anomaly(
    lon: xr.DataArray,
    lat: xr.DataArray,
    lon0: float,
    lat0: float,
    radius_m: float,
    amplitude_m: float,
    kind: str,
    rankine_outer_factor: float = 3.0,
) -> xr.DataArray:
    """Return the surface-height anomaly defining the eddy."""
    x, y = _metric_offsets(lon, lat, lon0, lat0)
    r = np.hypot(x, y)
    if kind == "gaussian":
        eta = amplitude_m * np.exp(-0.5 * (r / radius_m) ** 2)
    else:
        # Integral of the Rankine tangential-speed shape: r/R inside and R/r
        # outside. The height is referenced to zero at rankine_outer_factor*R.
        outer = rankine_outer_factor * radius_m
        normalizer = radius_m * (0.5 + np.log(rankine_outer_factor))
        inside = radius_m * np.log(rankine_outer_factor) + (
            radius_m**2 - r**2
        ) / (2.0 * radius_m)
        outside = radius_m * np.log(outer / xr.where(r > 0, r, 1.0))
        eta = amplitude_m * xr.where(
            r <= radius_m, inside / normalizer,
            xr.where(r < outer, outside / normalizer, 0.0),
        )
    eta.name = "idealized_eddy_zos_anomaly"
    eta.attrs = {
        "long_name": f"{kind.capitalize()} idealized eddy sea surface height anomaly",
        "standard_name": "sea_surface_height_above_geoid",
        "units": "m",
        "eddy_center_longitude": lon0,
        "eddy_center_latitude": lat0,
        "eddy_radius": radius_m,
        "eddy_amplitude": amplitude_m,
    }
    return eta


def geostrophic_velocity(
    eta: xr.DataArray,
    lon: xr.DataArray,
    lat: xr.DataArray,
    reference_latitude: float,
    min_abs_f: float = 1.0e-5,
):
    """Calculate geostrophic velocity on an f-plane centered on the eddy."""
    lat_name, lon_name = lat.dims[0], lon.dims[0]
    lat_rad = np.deg2rad(lat)
    f = 2.0 * OMEGA * np.sin(np.deg2rad(reference_latitude))
    if abs(f) < min_abs_f:
        raise ValueError(
            "The eddy center is too close to the equator for an f-plane "
            f"geostrophic construction (|f0| < {min_abs_f:g} s-1)."
        )
    deta_dlat = eta.differentiate(lat_name) * (180.0 / np.pi) / EARTH_RADIUS
    deta_dlon = eta.differentiate(lon_name) * (180.0 / np.pi)
    dx_dlon = EARTH_RADIUS * np.cos(lat_rad)
    deta_dx = deta_dlon / dx_dlon
    u_surface = -GRAVITY * deta_dlat / f
    v_surface = GRAVITY * deta_dx / f
    u_surface.attrs = {"long_name": "Idealized eddy zonal velocity anomaly", "units": "m s-1"}
    v_surface.attrs = {"long_name": "Idealized eddy meridional velocity anomaly", "units": "m s-1"}
    return u_surface, v_surface


def vertical_shape(depth: xr.DataArray, influence_depth_m: float, shape: str):
    """Dimensionless vertical decay, equal to one at z=0."""
    z = np.abs(depth)
    if shape == "exponential":
        decay = np.exp(-z / influence_depth_m)
    else:
        decay = np.exp(-0.5 * (z / influence_depth_m) ** 2)
    decay.name = "eddy_vertical_decay"
    decay.attrs = {"long_name": "Idealized eddy vertical decay", "units": "1"}
    return decay


def _clean_encoding(source: xr.Dataset) -> dict:
    """Retain useful storage settings without copying backend-only keys."""
    allowed = {"dtype", "_FillValue", "zlib", "complevel", "shuffle", "chunksizes",
               "fletcher32", "contiguous", "least_significant_digit"}
    result = {}
    for name, variable in source.variables.items():
        enc = {key: value for key, value in variable.encoding.items() if key in allowed}
        if enc.get("chunksizes") and len(enc["chunksizes"]) != variable.ndim:
            enc.pop("chunksizes", None)
        if enc:
            result[name] = enc
    return result


def embed_eddy(
    input_path: str | Path,
    output_path: str | Path,
    *,
    longitude: float,
    latitude: float,
    radius_km: float,
    amplitude_cm: float,
    influence_depth_m: float,
    kind: str = "gaussian",
    vertical_decay: str = "exponential",
    names: dict[str, str] | None = None,
) -> xr.Dataset:
    """Read, modify, and write a GLORYS dataset; return diagnostic anomalies.

    ``zos`` is optional: SSH still defines the balanced velocity anomaly, but is
    only added to the output when the input contains that variable.
    """
    names = names or {}
    n = {
        "lon": names.get("lon", "longitude"), "lat": names.get("lat", "latitude"),
        "depth": names.get("depth", "depth"), "zos": names.get("zos", "zos"),
        "uo": names.get("uo", "uo"), "vo": names.get("vo", "vo"),
        "thetao": names.get("thetao", "thetao"), "so": names.get("so", "so"),
    }
    with xr.open_dataset(input_path, decode_cf=True) as opened:
        required = ("lon", "lat", "depth", "uo", "vo", "thetao", "so")
        missing = [n[key] for key in required if n[key] not in opened.variables]
        if missing:
            raise KeyError(
                "Required GLORYS coordinates/variables are missing: "
                + ", ".join(missing)
                + ". Use --names-json to map non-standard names."
            )
        ds = opened.load()
        original_encoding = _clean_encoding(opened)

    lon, lat, depth = ds[n["lon"]], ds[n["lat"]], ds[n["depth"]]
    if lon.ndim != 1 or lat.ndim != 1 or depth.ndim != 1:
        raise ValueError("This workflow currently requires 1-D lon, lat, and depth coordinates.")
    if not (float(lat.min()) <= latitude <= float(lat.max())):
        raise ValueError("Eddy center latitude lies outside the input domain.")

    eta = ssh_anomaly(
        lon, lat, longitude, latitude, radius_km * 1000.0,
        amplitude_cm / 100.0, kind,
    )
    us, vs = geostrophic_velocity(eta, lon, lat, latitude)
    decay = vertical_shape(depth, influence_depth_m, vertical_decay)
    u3d = (decay * us).transpose(*ds[n["uo"]].dims[-3:])
    v3d = (decay * vs).transpose(*ds[n["vo"]].dims[-3:])

    # xarray broadcasts eta/u3d/v3d across time and preserves land NaNs.
    out = ds.copy(deep=False)
    if n["zos"] in ds:
        out[n["zos"]] = ds[n["zos"]] + eta.astype(ds[n["zos"]].dtype)
    out[n["uo"]] = ds[n["uo"]] + u3d.astype(ds[n["uo"]].dtype)
    out[n["vo"]] = ds[n["vo"]] + v3d.astype(ds[n["vo"]].dtype)
    modified = ("zos", "uo", "vo") if n["zos"] in ds else ("uo", "vo")
    for key in modified:
        out[n[key]].attrs = ds[n[key]].attrs.copy()

    current_speed = np.hypot(out[n["uo"]], out[n["vo"]])
    current_direction = (
        np.degrees(np.arctan2(out[n["uo"]], out[n["vo"]])) + 360.0
    ) % 360.0
    current_direction = current_direction.where(
        np.isfinite(current_speed) & (current_speed > 0)
    )
    out["current_speed"] = current_speed.astype(np.float32)
    out["current_speed"].attrs = {
        "long_name": "Sea water current speed",
        "units": "m s-1",
        "derived_from": f"{n['uo']} {n['vo']}",
    }
    out["current_direction"] = current_direction.astype(np.float32)
    out["current_direction"].attrs = {
        "long_name": "Direction toward which sea water is flowing",
        "units": "degree",
        "direction_reference": "clockwise from true north",
        "derived_from": f"{n['uo']} {n['vo']}",
    }
    original_encoding.pop("current_speed", None)
    original_encoding.pop("current_direction", None)
    out.attrs = ds.attrs.copy()
    out.attrs.update({
        "history": (
            ds.attrs.get("history", "") + "\n"
            f"Embedded {kind} idealized eddy at ({longitude}, {latitude}); "
            f"R={radius_km} km, SSH amplitude={amplitude_cm} cm, "
            f"vertical scale={influence_depth_m} m ({vertical_decay})."
        ).strip(),
        "idealized_eddy_parameters": json.dumps({
            "longitude": longitude, "latitude": latitude, "radius_km": radius_km,
            "amplitude_cm": amplitude_cm, "influence_depth_m": influence_depth_m,
            "kind": kind, "vertical_decay": vertical_decay,
            "ssh_added_to_zos": n["zos"] in ds,
        }),
        "derived_current_variables": "current_speed current_direction",
    })
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    out.to_netcdf(output_path, encoding=original_encoding)
    return xr.Dataset({"eta": eta, "u_surface": us, "v_surface": vs, "decay": decay})


def plot_diagnostics(
    input_path: str | Path,
    output_path: str | Path,
    figure_path: str | Path,
    diagnostics: xr.Dataset,
    longitude: float,
    latitude: float,
    names: dict[str, str] | None = None,
) -> None:
    """Plot imposed SSH/velocity/vorticity and unchanged T/S center profiles."""
    import matplotlib.pyplot as plt

    names = names or {}
    n = {k: names.get(k, k) for k in ("zos", "uo", "vo", "thetao", "so")}
    n.update({"lon": names.get("lon", "longitude"), "lat": names.get("lat", "latitude"),
              "depth": names.get("depth", "depth")})
    before = xr.open_dataset(input_path)
    after = xr.open_dataset(output_path)
    eta, u, v = diagnostics["eta"], diagnostics["u_surface"], diagnostics["v_surface"]
    lat, lon = after[n["lat"]], after[n["lon"]]
    dvdx = v.differentiate(n["lon"]) * (180 / np.pi) / (
        EARTH_RADIUS * np.cos(np.deg2rad(lat))
    )
    dudy = u.differentiate(n["lat"]) * (180 / np.pi) / EARTH_RADIUS
    zeta = dvdx - dudy

    # Show the eddy neighborhood rather than letting quiver autoscaling magnify
    # machine-zero velocities across a basin-scale GLORYS domain.
    active = np.abs(eta) >= float(np.abs(eta).max()) * 1.0e-4
    iy, ix = np.where(active.values)
    pad = 3
    y_slice = slice(max(0, iy.min() - pad), min(len(lat), iy.max() + pad + 1))
    x_slice = slice(max(0, ix.min() - pad), min(len(lon), ix.max() + pad + 1))
    eta = eta.isel({n["lat"]: y_slice, n["lon"]: x_slice})
    u = u.isel({n["lat"]: y_slice, n["lon"]: x_slice})
    v = v.isel({n["lat"]: y_slice, n["lon"]: x_slice})
    zeta = zeta.isel({n["lat"]: y_slice, n["lon"]: x_slice})
    lat = lat.isel({n["lat"]: y_slice})
    lon = lon.isel({n["lon"]: x_slice})
    speed = np.hypot(u, v)
    stride = max(1, min(len(lon), len(lat)) // 30)

    fig, axes = plt.subplots(2, 2, figsize=(13, 10), constrained_layout=True)
    p = axes[0, 0].pcolormesh(lon, lat, eta * 100, shading="auto", cmap="RdBu_r")
    fig.colorbar(p, ax=axes[0, 0], label="SSH anomaly (cm)")
    axes[0, 0].set_title("Imposed SSH anomaly")
    q = axes[0, 1].pcolormesh(lon, lat, speed, shading="auto", cmap="viridis")
    axes[0, 1].quiver(
        lon[::stride], lat[::stride],
        u[::stride, ::stride], v[::stride, ::stride], color="white",
    )
    fig.colorbar(q, ax=axes[0, 1], label="Speed anomaly (m s$^{-1}$)")
    axes[0, 1].set_title("Surface geostrophic velocity anomaly")
    p = axes[1, 0].pcolormesh(lon, lat, zeta * 86400, shading="auto", cmap="RdBu_r")
    fig.colorbar(p, ax=axes[1, 0], label="Relative vorticity (day$^{-1}$)")
    axes[1, 0].set_title("Surface relative vorticity anomaly")

    ax_t = axes[1, 1]
    for dataset, style, label in ((before, "-", "background"), (after, "--", "output")):
        point = dataset.sel({n["lon"]: longitude, n["lat"]: latitude}, method="nearest")
        profile = point[n["thetao"]].squeeze()
        ax_t.plot(profile.values, profile[n["depth"]].values, ls=style,
                  color="tab:blue", label=f"T {label}")
    ax_s = ax_t.twiny()
    for dataset, style, label in ((before, "-", "background"), (after, "--", "output")):
        point = dataset.sel({n["lon"]: longitude, n["lat"]: latitude}, method="nearest")
        profile = point[n["so"]].squeeze()
        ax_s.plot(profile.values, profile[n["depth"]].values, ls=style,
                  color="tab:orange", label=f"S {label}")
    ax_t.invert_yaxis()
    ax_t.set_title("Center T/S profiles (unchanged)")
    ax_t.set_xlabel("Temperature")
    ax_s.set_xlabel("Salinity")
    ax_t.legend(loc="lower left")
    ax_s.legend(loc="lower right")
    for ax in axes.flat[:3]:
        ax.plot(longitude, latitude, "k+", ms=10)
        ax.set_xlabel("Longitude")
        ax.set_ylabel("Latitude")
    fig.savefig(figure_path, dpi=180)
    plt.close(fig)
    before.close()
    after.close()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", help="Input GLORYS NetCDF")
    parser.add_argument("output", help="Output NetCDF")
    parser.add_argument("--longitude", type=float, required=True)
    parser.add_argument("--latitude", type=float, required=True)
    parser.add_argument("--radius-km", type=float, choices=range(50, 101), required=True)
    parser.add_argument("--amplitude-cm", type=float, required=True)
    parser.add_argument("--influence-depth-m", type=float, required=True)
    parser.add_argument("--kind", choices=("gaussian", "rankine"), default="gaussian")
    parser.add_argument("--vertical-decay", choices=("exponential", "gaussian"),
                        default="exponential")
    parser.add_argument("--figure", help="Optional diagnostic PNG")
    parser.add_argument("--names-json", default="{}",
                        help='Variable mapping, e.g. \'{"zos":"sla"}\'')
    args = parser.parse_args()
    if not 5 <= args.amplitude_cm <= 20:
        parser.error("--amplitude-cm must be in [5, 20]; use a negative value in code for cyclonic SSH")
    if not 500 <= args.influence_depth_m <= 1000:
        parser.error("--influence-depth-m must be in [500, 1000]")
    return args


def main() -> None:
    args = parse_args()
    names = json.loads(args.names_json)
    diagnostics = embed_eddy(
        args.input, args.output, longitude=args.longitude, latitude=args.latitude,
        radius_km=args.radius_km, amplitude_cm=args.amplitude_cm,
        influence_depth_m=args.influence_depth_m, kind=args.kind,
        vertical_decay=args.vertical_decay, names=names,
    )
    if args.figure:
        plot_diagnostics(
            args.input, args.output, args.figure, diagnostics,
            args.longitude, args.latitude, names,
        )


if __name__ == "__main__":
    main()
