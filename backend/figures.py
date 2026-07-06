"""
Plotly figure builders — each returns a dict serializable to JSON.
"""

from __future__ import annotations

import json
import numpy as np
import plotly.graph_objects as go

from .data import nearest_idx


class _NumpyEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, np.ndarray):
            return obj.tolist()
        if isinstance(obj, np.integer):
            return int(obj)
        if isinstance(obj, np.floating):
            return float(obj)
        return super().default(obj)


def _fig_to_dict(fig) -> dict:
    raw = fig.to_dict()
    return json.loads(json.dumps(raw, cls=_NumpyEncoder, ensure_ascii=False))


# ---------------------------------------------------------------------------
# Variable metadata
# ---------------------------------------------------------------------------

VAR_META = {
    "ss":    dict(label="声速",    unit="m/s",  colorscale="Viridis",  line_color="#58a6ff", vmin=1480, vmax=1560),
    "temp":  dict(label="温度",    unit="°C",   colorscale="RdYlBu_r", line_color="#ff9f43", vmin=0,    vmax=35),
    "salt":  dict(label="盐度",    unit="PSU",  colorscale="Blues",    line_color="#48dbfb", vmin=30,   vmax=40),
    "uo":    dict(label="东向流速", unit="m/s",  colorscale="RdBu_r",   line_color="#a29bfe", vmin=-1.5, vmax=1.5),
    "vo":    dict(label="北向流速", unit="m/s",  colorscale="RdBu_r",   line_color="#a29bfe", vmin=-1.5, vmax=1.5),
    "uv":    dict(label="流速",    unit="m/s",  colorscale="Viridis",  line_color="#a29bfe", vmin=0,    vmax=2),
    "u10":   dict(label="风速u",   unit="m/s",  colorscale="RdBu_r",   line_color="#fd79a8", vmin=-15,  vmax=15),
    "v10":   dict(label="风速v",   unit="m/s",  colorscale="RdBu_r",   line_color="#fd79a8", vmin=-15,  vmax=15),
    "wind":  dict(label="风速",    unit="m/s",  colorscale="YlOrRd",   line_color="#fd79a8", vmin=0,    vmax=20),
    "swh":   dict(label="有效波高", unit="m",   colorscale="Blues",    line_color="#74b9ff", vmin=0,    vmax=6),
    "mwd_u": dict(label="波向u",   unit="",     colorscale="RdBu_r",   line_color="#55efc4", vmin=-1,   vmax=1),
    "mwd_v": dict(label="波向v",   unit="",     colorscale="RdBu_r",   line_color="#55efc4", vmin=-1,   vmax=1),
    "mwd":   dict(label="波向",    unit="°",    colorscale="HSV",      line_color="#55efc4", vmin=0,    vmax=360),
}

def _nan_colorscale(name_or_list, vmin: float, vmax: float):
    """Return (colorscale, sentinel) with transparent NaN slot.

    name_or_list: Plotly named colorscale string OR pre-built [[pos, color], ...] list.
    sentinel = vmin - span*0.01 sits in the transparent [0, p0*0.5] slot.
    Out-of-range valid values clamp to the nearest endpoint color.
    """
    import plotly.colors as pc
    if isinstance(name_or_list, list):
        cs = name_or_list
    else:
        cs = pc.get_colorscale(name_or_list)
    span = vmax - vmin if vmax != vmin else 1.0
    sentinel = vmin - span * 0.01
    total = vmax - sentinel
    p0 = (vmin - sentinel) / total
    shifted = [[p0 + s[0] * (1.0 - p0), s[1]] for s in cs]
    colorscale = [[0.0, "rgba(0,0,0,0)"], [p0 * 0.5, shifted[0][1]]] + shifted[1:]
    return colorscale, sentinel


def _apply_sentinel(data, sentinel: float, vmin: float, vmax: float):
    """Replace NaN with sentinel; clamp valid data to [vmin, vmax] so no valid
    value falls into the transparent sentinel slot below vmin."""
    out = np.array(data, dtype=float)
    valid = ~np.isnan(out)
    out[valid] = np.clip(out[valid], vmin, vmax)
    out[~valid] = sentinel
    return out


def _var_meta(variable: str) -> dict:
    return VAR_META.get(variable, VAR_META["ss"])


# ---------------------------------------------------------------------------
# Shared style helpers
# ---------------------------------------------------------------------------

def _colorbar_style(unit: str = "m/s", len: float = 0.8):
    return dict(
        title=dict(text=unit, font=dict(color="#334155", size=11), side="top"),
        tickfont=dict(color="#64748b", size=10),
        bgcolor="#ffffff",
        bordercolor="#e2e8f0",
        orientation="v",
        x=1.01, xanchor="left",
        y=0.5,  yanchor="middle",
        len=len,
        thickness=12,
    )


def _panel_layout(**extra):
    base = dict(
        paper_bgcolor="#ffffff",
        plot_bgcolor="#ffffff",
        font=dict(color="#334155"),
        margin=dict(l=10, r=60, t=10, b=10),
    )
    base.update(extra)
    return base


def _empty_fig(msg: str) -> dict:
    fig = go.Figure()
    fig.add_annotation(text=msg, x=0.5, y=0.5, xref="paper", yref="paper",
                       showarrow=False, font=dict(size=13, color="#94a3b8"))
    fig.update_layout(
        paper_bgcolor="#ffffff", plot_bgcolor="#ffffff",
        font=dict(color="#334155"),
        margin=dict(l=10, r=10, t=10, b=10),
        xaxis=dict(visible=False), yaxis=dict(visible=False),
    )
    return _fig_to_dict(fig)


# ---------------------------------------------------------------------------
# 3D volume figure
# ---------------------------------------------------------------------------

def make_volume_fig(data, lats, lons, depths, variable: str = "ss",
                    vmin: float = None, vmax: float = None,
                    colorscale: str = None,
                    colorscale_custom: list = None,
                    depth_indices: list = None) -> dict:
    meta    = _var_meta(variable)
    n_depth = len(depths)
    vmin    = vmin if vmin is not None else float(np.nanmin(data))
    vmax    = vmax if vmax is not None else float(np.nanmax(data))
    if colorscale_custom and len(colorscale_custom) == 2:
        cs_input = [[0.0, colorscale_custom[0]], [1.0, colorscale_custom[1]]]
    else:
        cs_input = colorscale if colorscale else meta["colorscale"]

    # Default: every other layer (half density)
    if depth_indices is None:
        depth_indices = list(range(0, n_depth, 2))
    else:
        depth_indices = [i for i in depth_indices if 0 <= i < n_depth]
    if not depth_indices:
        depth_indices = [0]

    STEP3D   = 8
    data_ds  = data[:, ::STEP3D, ::STEP3D]
    lats_ds  = lats[::STEP3D]
    lons_ds  = lons[::STEP3D]
    LON, LAT = np.meshgrid(lons_ds, lats_ds)

    depth_display = (depths - depths[0]) / (depths[-1] - depths[0])

    cs, sentinel = _nan_colorscale(cs_input, vmin, vmax)

    fig = go.Figure()
    for i in depth_indices:
        layer   = data_ds[i]
        d_label = f"{depths[i]:.1f} m"
        nan_mask = np.isnan(layer)
        Z_flat = np.where(nan_mask, np.nan, depth_display[i])
        layer_plot = _apply_sentinel(layer, sentinel, vmin, vmax)
        fig.add_trace(go.Surface(
            x=LON, y=LAT, z=Z_flat,
            surfacecolor=layer_plot,
            hovertemplate=(
                "Lon: %{x:.6f}°E  Lat: %{y:.6f}°N<br>"
                f"Depth: {d_label}"
                "<extra></extra>"
            ),
            colorscale=cs,
            cmin=sentinel,
            cmax=vmax,
            showscale=(i == depth_indices[0]),
            colorbar=_colorbar_style(meta["unit"]) if i == depth_indices[0] else None,
            opacity=0.85,
            name=d_label,
        ))

    z_tick_vals = depth_display[::4].tolist()
    z_tick_text = [f"{depths[i]:.0f}m" for i in range(0, n_depth, 4)]

    fig.update_layout(
        paper_bgcolor="#ffffff",
        font=dict(color="#334155"),
        margin=dict(l=0, r=60, t=30, b=10),
        scene=dict(
            xaxis=dict(title=dict(text="Lon (°E)", font=dict(color="#334155")),
                       backgroundcolor="#ffffff", gridcolor="#e2e8f0",
                       showbackground=True, color="#334155"),
            yaxis=dict(title=dict(text="Lat (°N)", font=dict(color="#334155")),
                       backgroundcolor="#ffffff", gridcolor="#e2e8f0",
                       showbackground=True, color="#334155"),
            zaxis=dict(
                title=dict(text="Depth", font=dict(color="#334155")),
                backgroundcolor="#ffffff", gridcolor="#e2e8f0",
                showbackground=True, color="#334155",
                tickvals=z_tick_vals, ticktext=z_tick_text,
                range=[1, 0],
            ),
            bgcolor="#ffffff",
            camera=dict(eye=dict(x=1.6, y=-1.6, z=0.8)),
            aspectmode="manual",
            aspectratio=dict(x=2, y=1.5, z=0.8),
        ),
        legend=dict(visible=False),
    )
    return _fig_to_dict(fig)


# ---------------------------------------------------------------------------
# Quiver (vector arrow) trace
# ---------------------------------------------------------------------------

def make_quiver_trace(u, v, lats, lons, step: int = 20, scale_factor: float = 0.4):
    """Build arrow traces overlaid on a Heatmap (vectorized)."""
    lats_ds = lats[::step]
    lons_ds = lons[::step]
    u_ds = u[::step, ::step]
    v_ds = v[::step, ::step]

    dlat = float(abs(lats_ds[1] - lats_ds[0])) if len(lats_ds) > 1 else 1.0
    dlon = float(abs(lons_ds[1] - lons_ds[0])) if len(lons_ds) > 1 else 1.0
    scale = min(dlat, dlon) * scale_factor

    mag = np.sqrt(u_ds**2 + v_ds**2)
    max_mag = float(np.nanmax(mag))
    if max_mag == 0 or np.isnan(max_mag):
        return None

    LON_DS, LAT_DS = np.meshgrid(lons_ds, lats_ds)

    # 过滤有效点
    valid = ~(np.isnan(u_ds) | np.isnan(v_ds) | (mag == 0))
    lon0 = LON_DS[valid]
    lat0 = LAT_DS[valid]
    um   = u_ds[valid]
    vm   = v_ds[valid]
    m    = mag[valid]

    frac    = 0.2 + 0.8 * (m / max_mag)
    dlon_v  = (um / m) * scale * frac
    dlat_v  = (vm / m) * scale * frac
    lon1    = lon0 + dlon_v
    lat1    = lat0 + dlat_v

    # shaft: [tail, head, None] per arrow — interleave via reshape
    nan_col = np.full(len(lon0), np.nan)
    shaft_x = np.stack([lon0, lon1, nan_col], axis=1).ravel()
    shaft_y = np.stack([lat0, lat1, nan_col], axis=1).ravel()

    math_deg    = np.degrees(np.arctan2(dlat_v, dlon_v))
    head_angle  = 90.0 - math_deg

    shaft_trace = go.Scattergl(
        x=shaft_x, y=shaft_y,
        mode="lines",
        line=dict(color="rgba(20,20,20,0.7)", width=2),
        showlegend=False,
        hoverinfo="skip",
    )
    head_trace = go.Scattergl(
        x=lon1.tolist(), y=lat1.tolist(),
        mode="markers",
        marker=dict(
            symbol="arrow",
            size=10,
            angle=head_angle,
            color="rgba(20,20,20,0.85)",
            line=dict(width=0),
        ),
        showlegend=False,
        hoverinfo="skip",
    )
    return shaft_trace, head_trace


# ---------------------------------------------------------------------------
# 2D layer heatmap
# ---------------------------------------------------------------------------

def make_layer_fig(data, lats, lons, depths, depth_idx: int, points: list,
                   variable: str = "ss",
                   vmin: float = None, vmax: float = None,
                   colorscale: str = None,
                   colorscale_custom: list = None,
                   quiver_uv: tuple = None,
                   is_2d: bool = False) -> dict:
    meta    = _var_meta(variable)
    if colorscale_custom and len(colorscale_custom) == 2:
        cs_input = [[0.0, colorscale_custom[0]], [1.0, colorscale_custom[1]]]
    else:
        cs_input = colorscale if colorscale else meta["colorscale"]
    vmin    = vmin if vmin is not None else float(np.nanmin(data))
    vmax    = vmax if vmax is not None else float(np.nanmax(data))

    # data is always the 2D array to display (magnitude for vector, surface for 2D vars,
    # or the full 3D array for scalar 3D vars where we slice by depth_idx)
    if is_2d or data.ndim == 2:
        z_full = data
    else:
        z_full = data[depth_idx]

    # Downsample heatmap — step=2 cuts payload 4× with no visible quality loss
    STEP2D = 2
    z_plot   = z_full[::STEP2D, ::STEP2D]
    lat_plot = lats[::STEP2D]
    lon_plot = lons[::STEP2D]

    fig = go.Figure()
    fig.add_trace(go.Heatmap(
        z=z_plot, x=lon_plot, y=lat_plot,
        colorscale=cs_input,
        zmin=vmin,
        zmax=vmax,
        colorbar=_colorbar_style(meta["unit"]),
        zsmooth=False,
        hovertemplate=(
            "Lon: %{x:.2f}°E<br>Lat: %{y:.2f}°N<br>"
            f"{meta['label']}: " + "%{z:.2f} " + meta["unit"] + "<extra></extra>"
        ),
    ))

    # Quiver overlay for vector variables
    # u_arr and v_arr from quiver_uv are already 2D slices (prepared by caller)
    if quiver_uv is not None:
        u_arr, v_arr, step = quiver_uv
        sf = 0.8 if variable == "uv" else 0.4
        result = make_quiver_trace(u_arr, v_arr, lats, lons, step, scale_factor=sf)
        if result is not None:
            shaft_trace, head_trace = result
            fig.add_trace(shaft_trace)
            fig.add_trace(head_trace)

    if points:
        fig.add_trace(go.Scattergl(
            x=[p["lon"] for p in points],
            y=[p["lat"] for p in points],
            mode="markers+text",
            marker=dict(color="#ff7b72", size=10,
                        line=dict(color="white", width=1.5)),
            text=[f"P{i+1}" for i in range(len(points))],
            textposition="top right",
            textfont=dict(color="white", size=11),
            showlegend=False, hoverinfo="skip",
        ))
        if len(points) == 2:
            fig.add_trace(go.Scattergl(
                x=[points[0]["lon"], points[1]["lon"]],
                y=[points[0]["lat"], points[1]["lat"]],
                mode="lines",
                line=dict(color="#ff7b72", width=2, dash="dash"),
                showlegend=False, hoverinfo="skip",
            ))

    fig.update_layout(
        **_panel_layout(margin=dict(l=40, r=60, t=10, b=40)),
        dragmode="pan",
        xaxis=dict(title="", gridcolor="#e2e8f0", automargin=False,
                   range=[float(lons[0]), float(lons[-1])]),
        yaxis=dict(title="", gridcolor="#e2e8f0", automargin=False,
                   range=[float(lats[0]), float(lats[-1])]),
    )
    return _fig_to_dict(fig)


# ---------------------------------------------------------------------------
# Vertical profile
# ---------------------------------------------------------------------------

def make_profile_fig(data, lats, lons, depths, lat: float, lon: float,
                     depth_idx: int,
                     variable: str = "ss",
                     depth_range: tuple = None,
                     value_range: tuple = None) -> tuple[dict, str, str]:
    meta    = _var_meta(variable)
    lat_i   = nearest_idx(lats, lat)
    lon_i   = nearest_idx(lons, lon)
    profile = data[:, lat_i, lon_i]
    depth_val = float(depths[depth_idx])

    fig = go.Figure()
    fig.add_trace(go.Scatter(
        x=profile, y=depths,
        mode="lines+markers",
        line=dict(color=meta["line_color"], width=2),
        marker=dict(size=5, color=meta["line_color"]),
        hovertemplate=f"{meta['label']}: " + "%{x:.2f} " + meta["unit"] + "<br>深度: %{y:.1f} m<extra></extra>",
    ))
    fig.add_hline(
        y=depth_val,
        line=dict(color="#ff7b72", width=1.5, dash="dot"),
        annotation_text=f"{depth_val:.1f} m",
        annotation_font_color="#ff7b72",
    )

    yaxis = dict(title="深度 (m)", gridcolor="#e2e8f0", autorange="reversed")
    xaxis = dict(title=f"{meta['label']} ({meta['unit']})", gridcolor="#e2e8f0")
    if depth_range:
        yaxis["range"] = [depth_range[1], depth_range[0]]
        yaxis.pop("autorange", None)
    if value_range:
        xaxis["range"] = list(value_range)

    fig.update_layout(**_panel_layout(), dragmode="pan", xaxis=xaxis, yaxis=yaxis)
    title = f"{meta['label']}垂直剖面：{float(lats[lat_i]):.2f}°N, {float(lons[lon_i]):.2f}°E"
    info  = f"网格点：{float(lats[lat_i]):.3f}°N, {float(lons[lon_i]):.3f}°E"
    return _fig_to_dict(fig), title, info


# ---------------------------------------------------------------------------
# Transect section
# ---------------------------------------------------------------------------

def make_transect_fig(data, lats, lons, depths, p1: dict, p2: dict,
                      depth_idx: int,
                      variable: str = "ss",
                      depth_range: tuple = None,
                      value_range: tuple = None) -> tuple[dict, str, str]:
    meta    = _var_meta(variable)
    vmin    = float(np.nanmin(data))
    vmax    = float(np.nanmax(data))
    n_depth = len(depths)
    depth_val = float(depths[depth_idx])

    n_pts    = 200
    lat_line = np.linspace(p1["lat"], p2["lat"], n_pts)
    lon_line = np.linspace(p1["lon"], p2["lon"], n_pts)

    section = np.full((n_depth, n_pts), np.nan)
    for k in range(n_pts):
        li = nearest_idx(lats, lat_line[k])
        lo = nearest_idx(lons, lon_line[k])
        section[:, k] = data[:, li, lo]

    R       = 6371.0
    dlat    = np.radians(lat_line - lat_line[0])
    dlon    = np.radians(lon_line - lon_line[0])
    lat_mid = np.radians((lat_line[0] + lat_line[-1]) / 2)
    dist_km = np.sqrt((dlat * R)**2 + (dlon * R * np.cos(lat_mid))**2)

    if value_range:
        zmin, zmax = value_range
    else:
        zmin, zmax = vmin, vmax

    fig = go.Figure()
    fig.add_trace(go.Contour(
        x=dist_km, y=depths, z=section,
        colorscale=meta["colorscale"], zmin=zmin, zmax=zmax,
        ncontours=30, contours_coloring="fill",
        colorbar=_colorbar_style(meta["unit"], len=1.0),
        hovertemplate=f"距离: " + "%{x:.1f} km<br>深度: %{y:.1f} m<br>" + f"{meta['label']}: " + "%{z:.2f} " + meta["unit"] + "<extra></extra>",
    ))
    fig.add_hline(
        y=depth_val,
        line=dict(color="#ff7b72", width=1.5, dash="dot"),
        annotation_text=f"{depth_val:.1f} m",
        annotation_font_color="#ff7b72",
    )

    yaxis = dict(title="深度 (m)", gridcolor="#e2e8f0", autorange="reversed")
    xaxis = dict(title="距离 (km)", gridcolor="#e2e8f0")
    if depth_range:
        yaxis["range"] = [depth_range[1], depth_range[0]]
        yaxis.pop("autorange", None)

    fig.update_layout(**_panel_layout(), dragmode="pan", xaxis=xaxis, yaxis=yaxis)
    title = (f"{meta['label']}断面：({p1['lat']:.2f}°N, {p1['lon']:.2f}°E) → "
             f"({p2['lat']:.2f}°N, {p2['lon']:.2f}°E)")
    info  = f"总距离：{dist_km[-1]:.1f} km"
    return _fig_to_dict(fig), title, info
