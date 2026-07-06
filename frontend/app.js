/**
 * Ocean Sound Speed — frontend logic
 */

const state = {
  depthIdx:    0,
  mode:        "point",   // "point" | "transect"
  variable:    "ss",      // current variable name
  varType:     "3d",      // "3d" | "2d"
  isVector:    false,     // whether current variable shows quiver arrows
  points:      [],
  meta:        null,
  colorRange:  null,
  depthRange:  null,
  valueRange:  null,
  varConfig:   {},
  quiverStep:  20,
  drag: {
    active:        false,
    pointIdx:      null,
    hoverPointIdx: null,
  },
  dateIdx:     0,
  dates:       [],
  isSeries:    false,
  playing:     false,
  playTimer:   null,
};

const VAR_LABELS = {
  ss: "声速", temp: "温度", salt: "盐度",
  uo: "东向流速", vo: "北向流速", uv: "流速",
  u10: "风速u", v10: "风速v", wind: "风速",
  swh: "有效波高",
  mwd_u: "波向u", mwd_v: "波向v", mwd: "波向",
};
const VAR_UNITS = {
  ss: "m/s", temp: "°C", salt: "PSU",
  uo: "m/s", vo: "m/s", uv: "m/s",
  u10: "m/s", v10: "m/s", wind: "m/s",
  swh: "m",
  mwd_u: "", mwd_v: "", mwd: "°",
};

const VAR_DEFAULTS = {
  ss:    { min: 1480, max: 1560, colorscale: "Viridis"  },
  temp:  { min: 0,    max: 35,   colorscale: "RdYlBu_r" },
  salt:  { min: 30,   max: 40,   colorscale: "Blues"    },
  uo:    { min: -1.5, max: 1.5,  colorscale: "RdBu_r"   },
  vo:    { min: -1.5, max: 1.5,  colorscale: "RdBu_r"   },
  uv:    { min: 0,    max: 2,    colorscale: "Viridis"  },
  u10:   { min: -15,  max: 15,   colorscale: "RdBu_r"   },
  v10:   { min: -15,  max: 15,   colorscale: "RdBu_r"   },
  wind:  { min: 0,    max: 20,   colorscale: "YlOrRd"   },
  swh:   { min: 0,    max: 6,    colorscale: "Blues"    },
  mwd_u: { min: -1,   max: 1,    colorscale: "RdBu_r"   },
  mwd_v: { min: -1,   max: 1,    colorscale: "RdBu_r"   },
  mwd:   { min: 0,    max: 360,  colorscale: "HSV"     },
};

const COLORSCALES = [
  "Viridis", "Plasma", "Inferno", "Magma", "Cividis",
  "RdYlBu_r", "RdBu_r", "Spectral_r",
  "Blues", "Greens", "YlOrRd",
  "Jet", "Turbo", "Rainbow",
  "HSV",
];

const PLOTLY_CONFIG = {
  scrollZoom: true,
  displayModeBar: true,
  doubleClick: "reset",
  displaylogo: false,
  modeBarButtonsToRemove: [
    "zoom2d", "pan2d", "select2d", "lasso2d",
    "zoomIn2d", "zoomOut2d", "autoScale2d", "resetScale2d",
    "zoom3d", "pan3d", "orbitRotation", "tableRotation",
    "resetCameraDefault3d", "resetCameraLastSave3d",
    "hoverClosestCartesian", "hoverCompareCartesian",
    "hoverClosest3d", "hoverClosestGl2d", "hoverClosestPie",
    "toggleHover", "toggleSpikelines", "resetViews",
  ],
};
const PLOTLY_CONFIG_MAP = {
  scrollZoom: true,
  displayModeBar: true,
  doubleClick: "reset",
  displaylogo: false,
  plotGlPixelRatio: 1,
  modeBarButtonsToRemove: [
    "zoom2d", "pan2d", "select2d", "lasso2d",
    "zoomIn2d", "zoomOut2d", "autoScale2d", "resetScale2d",
    "hoverClosestCartesian", "hoverCompareCartesian",
    "hoverClosestGl2d", "toggleHover", "toggleSpikelines", "resetViews",
  ],
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function apiFetch(url, options = {}) {
  const res = await fetch(url, options);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error ${res.status}: ${text}`);
  }
  return res.json();
}

function setClickInfo(text) {
  document.getElementById("map-click-info").textContent = text;
}

function setProfileTitle(text) {
  document.getElementById("profile-panel-title").textContent = text;
}

function setUploadStatus(msg, type = "") {
  const el = document.getElementById("upload-status");
  el.textContent = msg;
  el.className = "upload-status" + (type ? " " + type : "");
}

function _updateVarLabels(variable) {
  const label = VAR_LABELS[variable] || "值";
  const unit  = VAR_UNITS[variable]  || "";
  const labelEl = document.getElementById("value-range-label");
  const unitEl  = document.getElementById("value-range-unit");
  if (labelEl) labelEl.textContent = label;
  if (unitEl)  unitEl.textContent  = unit;
}

function _syncCbarInputs(range) {
  const minEl = document.getElementById("cmin");
  const maxEl = document.getElementById("cmax");
  if (!minEl || !maxEl) return;
  if (range) {
    minEl.value = range[0];
    maxEl.value = range[1];
  } else {
    minEl.value = "";
    maxEl.value = "";
  }
}

function _syncConfigUI(variable) {
  const cfg = state.varConfig[variable];
  if (!cfg) return;
  _syncCbarInputs([cfg.min, cfg.max]);

  const sel       = document.getElementById("colorscale-select");
  const minSwatch = document.getElementById("color-min-swatch");
  const minHex    = document.getElementById("color-min-hex");
  const maxSwatch = document.getElementById("color-max-swatch");
  const maxHex    = document.getElementById("color-max-hex");

  if (cfg.color_min && cfg.color_max) {
    if (sel) sel.value = "";
    if (minSwatch) minSwatch.value = cfg.color_min;
    if (minHex)    minHex.value    = cfg.color_min;
    if (maxSwatch) maxSwatch.value = cfg.color_max;
    if (maxHex)    maxHex.value    = cfg.color_max;
  } else {
    if (sel) sel.value = cfg.colorscale || "";
    if (minHex)    minHex.value    = "";
    if (maxHex)    maxHex.value    = "";
    if (minSwatch) minSwatch.value = "#000000";
    if (maxSwatch) maxSwatch.value = "#000000";
  }
}

// Drag helpers
let _profileDebounceTimer = null;
function _debouncedRenderProfile(delay = 150) {
  clearTimeout(_profileDebounceTimer);
  _profileDebounceTimer = setTimeout(() => renderProfile(), delay);
}

function _pixelToLatLon(gd, clientX, clientY) {
  const layout = gd._fullLayout;
  const rect   = gd.getBoundingClientRect();
  const px = clientX - rect.left - layout.margin.l;
  const py = clientY - rect.top  - layout.margin.t;
  const lon = layout.xaxis.p2d(px);
  const lat = layout.yaxis.p2d(py);
  const m = state.meta;
  return {
    lon: Math.max(m.lon_range[0], Math.min(m.lon_range[1], lon)),
    lat: Math.max(m.lat_range[0], Math.min(m.lat_range[1], lat)),
  };
}

function _updateMapMarkers() {
  const gd = document.getElementById("layer-map-graph");
  if (!gd || !state.points.length) return;
  Plotly.restyle(gd, {
    x: [state.points.map(p => p.lon)],
    y: [state.points.map(p => p.lat)],
  }, [1]);
  if (state.points.length === 2) {
    Plotly.restyle(gd, {
      x: [[state.points[0].lon, state.points[1].lon]],
      y: [[state.points[0].lat, state.points[1].lat]],
    }, [2]);
  }
}

// ---------------------------------------------------------------------------
// Upload screen
// ---------------------------------------------------------------------------

function initUploadScreen() {
  const input    = document.getElementById("nc-file-input");
  const dropZone = document.getElementById("drop-zone");

  input.addEventListener("change", () => {
    if (input.files[0]) handleFile(input.files[0]);
  });

  dropZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropZone.classList.add("drag-over");
  });
  dropZone.addEventListener("dragleave", () => dropZone.classList.remove("drag-over"));
  dropZone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropZone.classList.remove("drag-over");
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  });

  const modeSingleBtn = document.getElementById("mode-single-btn");
  const modeSeriesBtn = document.getElementById("mode-series-btn");
  const dropSingle    = document.getElementById("drop-zone");
  const dropSeries    = document.getElementById("drop-zone-series");
  const seriesInput   = document.getElementById("nc-series-input");

  modeSingleBtn.addEventListener("click", () => {
    modeSingleBtn.classList.add("active");
    modeSeriesBtn.classList.remove("active");
    dropSingle.classList.remove("hidden");
    dropSeries.classList.add("hidden");
  });
  modeSeriesBtn.addEventListener("click", () => {
    modeSeriesBtn.classList.add("active");
    modeSingleBtn.classList.remove("active");
    dropSeries.classList.remove("hidden");
    dropSingle.classList.add("hidden");
  });

  seriesInput.addEventListener("change", () => {
    if (seriesInput.files.length >= 2) handleSeriesFiles(seriesInput.files);
    else setUploadStatus("请至少选择 2 个文件", "error");
  });

  dropSeries.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropSeries.classList.add("drag-over");
  });
  dropSeries.addEventListener("dragleave", () => dropSeries.classList.remove("drag-over"));
  dropSeries.addEventListener("drop", (e) => {
    e.preventDefault();
    dropSeries.classList.remove("drag-over");
    const files = Array.from(e.dataTransfer.files).filter(f => f.name.endsWith(".nc"));
    if (files.length >= 2) handleSeriesFiles(files);
    else setUploadStatus("请拖入至少 2 个 .nc 文件", "error");
  });

  document.getElementById("reload-btn").addEventListener("click", () => {
    stopPlayback();
    state.isSeries = false;
    state.dates    = [];
    state.dateIdx  = 0;
    document.getElementById("main-screen").classList.add("hidden");
    document.getElementById("upload-screen").classList.remove("hidden");
    setUploadStatus("");
    input.value = "";
  });
}

async function handleFile(file) {
  if (!file.name.endsWith(".nc")) {
    setUploadStatus("请选择 .nc 格式的文件", "error");
    return;
  }

  setUploadStatus("正在上传并计算声速场，请稍候…", "loading");

  const form = new FormData();
  form.append("file", file);

  try {
    const result = await fetch("/api/upload", { method: "POST", body: form });
    if (!result.ok) {
      const err = await result.json();
      setUploadStatus("加载失败：" + (err.detail || result.statusText), "error");
      return;
    }
    const data = await result.json();
    setUploadStatus(`已加载：${data.filename}  (${data.shape.join(" × ")})`, "success");

    document.getElementById("upload-screen").classList.add("hidden");
    document.getElementById("main-screen").classList.remove("hidden");
    document.getElementById("loaded-filename").textContent = data.filename;

    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    await initMainScreen();
  } catch (e) {
    setUploadStatus("网络错误：" + e.message, "error");
  }
}

async function handleSeriesFiles(files) {
  setUploadStatus(`正在上传 ${files.length} 个文件，请稍候…`, "loading");

  const form = new FormData();
  Array.from(files).forEach(f => form.append("files", f));

  try {
    const result = await fetch("/api/upload_series", { method: "POST", body: form });
    if (!result.ok) {
      const err = await result.json();
      setUploadStatus("加载失败：" + (err.detail || result.statusText), "error");
      return;
    }
    const data = await result.json();
    setUploadStatus(`已加载 ${data.dates.length} 帧序列`, "success");

    document.getElementById("upload-screen").classList.add("hidden");
    document.getElementById("main-screen").classList.remove("hidden");
    document.getElementById("loaded-filename").textContent =
      `序列 ${data.dates[0]} → ${data.dates[data.dates.length - 1]}`;

    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    await initMainScreen();
  } catch (e) {
    setUploadStatus("网络错误：" + e.message, "error");
  }
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

async function initMainScreen() {
  state.meta       = await apiFetch("/api/meta");
  const seriesInfo = await apiFetch("/api/dates");
  state.isSeries = seriesInfo.is_series;
  state.dates    = seriesInfo.dates;
  state.dateIdx  = 0;
  state.points     = [];
  state.depthIdx   = 0;
  state.variable   = "ss";
  state.varType    = "3d";
  state.isVector   = false;
  state.quiverStep = 20;
  state.depthRange = null;
  state.valueRange = null;
  ["depth-min","depth-max","speed-min","speed-max"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // Initialise per-variable config from server
  const allVars = Object.keys(VAR_DEFAULTS);
  try {
    const saved = await apiFetch("/api/config");
    allVars.forEach(v => {
      state.varConfig[v] = saved[v] ? { ...VAR_DEFAULTS[v], ...saved[v] } : { ...VAR_DEFAULTS[v] };
    });
  } catch {
    allVars.forEach(v => { state.varConfig[v] = { ...VAR_DEFAULTS[v] }; });
  }
  const initCfg = state.varConfig["ss"];
  state.colorRange = [initCfg.min, initCfg.max];

  // Populate colorscale select
  const sel = document.getElementById("colorscale-select");
  if (sel) {
    sel.innerHTML = "";
    COLORSCALES.forEach(name => {
      const opt = document.createElement("option");
      opt.value = name;
      opt.textContent = name;
      sel.appendChild(opt);
    });
  }
  _syncConfigUI("ss");

  // Link color swatches ↔ hex inputs; handle preset/custom mutual exclusion
  function _linkColor(swatchId, hexId) {
    const swatch = document.getElementById(swatchId);
    const hex    = document.getElementById(hexId);
    if (!swatch || !hex) return;
    swatch.addEventListener("input", () => {
      hex.value = swatch.value;
      document.getElementById("colorscale-select").value = "";
    });
    hex.addEventListener("input", () => {
      if (/^#[0-9a-fA-F]{6}$/.test(hex.value)) {
        swatch.value = hex.value;
        document.getElementById("colorscale-select").value = "";
      }
    });
  }
  _linkColor("color-min-swatch", "color-min-hex");
  _linkColor("color-max-swatch", "color-max-hex");

  document.getElementById("colorscale-select").addEventListener("change", () => {
    document.getElementById("color-min-hex").value    = "";
    document.getElementById("color-max-hex").value    = "";
    document.getElementById("color-min-swatch").value = "#000000";
    document.getElementById("color-max-swatch").value = "#000000";
  });

  // Quiver step slider
  const quiverStepEl    = document.getElementById("quiver-step");
  const quiverLabelEl   = document.getElementById("quiver-step-label");
  if (quiverStepEl) {
    quiverStepEl.addEventListener("input", () => {
      state.quiverStep = parseInt(quiverStepEl.value);
      if (quiverLabelEl) quiverLabelEl.textContent = `步长 ${state.quiverStep}`;
      renderLayer(state.depthIdx, state.points);
    });
  }

  // Fill meta display
  const m = state.meta;
  const setText = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  setText("meta-lon",    `${m.lon_range[0].toFixed(1)}° – ${m.lon_range[1].toFixed(1)}°`);
  setText("meta-lat",    `${m.lat_range[0].toFixed(1)}° – ${m.lat_range[1].toFixed(1)}°`);
  setText("meta-depths", `${m.depths.length} 层`);
  setText("meta-grid",   `${m.grid_shape ? m.grid_shape.join(" × ") : "--"}`);
  setText("depth-index", `第 1 / ${m.depths.length} 层`);
  setText("depth-total", `共 ${m.depths.length} 层`);
  _updateVarLabels("ss");

  function _updateVolTitle(variable) {
    const el = document.getElementById("vol-panel-title");
    if (el) el.textContent = `3D ${VAR_LABELS[variable] || ""}场`;
  }
  _updateVolTitle("ss");

  function _apply2DMode() {
    const is2d = state.varType === "2d";
    const panel3d    = document.getElementById("panel-3d");
    const resizer    = document.getElementById("resizer");
    const rowResizer = document.getElementById("row-resizer");
    const profPanel  = document.querySelector(".panel-profile");
    const depthCard  = document.querySelector(".side-card:has(#depth-select)") ||
                       document.getElementById("depth-select")?.closest(".side-card");
    const depthSlider = document.getElementById("depth-slider");
    const depthSelect = document.getElementById("depth-select");
    const quiverRow   = document.getElementById("quiver-density-row");

    if (panel3d)    panel3d.style.display    = is2d ? "none" : "";
    if (resizer)    resizer.style.display    = is2d ? "none" : "";
    if (rowResizer) rowResizer.style.display = is2d ? "none" : "";
    if (profPanel)  profPanel.style.display  = is2d ? "none" : "";
    if (depthSlider) depthSlider.disabled = is2d;
    if (depthSelect) depthSelect.disabled = is2d;
    if (depthCard) depthCard.style.opacity = is2d ? "0.4" : "";
    if (quiverRow) quiverRow.classList.toggle("hidden", !state.isVector);

    // Trigger Plotly resize so the map fills newly available space
    const mapEl = document.getElementById("layer-map-graph");
    if (mapEl) requestAnimationFrame(() => Plotly.Plots.resize(mapEl));
  }

  // Variable cards — both groups
  document.querySelectorAll(".var-card").forEach(card => {
    card.classList.toggle("active", card.dataset.var === "ss");
    card.addEventListener("click", () => {
      document.querySelectorAll(".var-card").forEach(c => c.classList.remove("active"));
      card.classList.add("active");
      const v = card.dataset.var;
      state.variable   = v;
      state.varType    = (state.meta.vars_2d || []).includes(v) ? "2d" : "3d";
      state.isVector   = (state.meta.vars_vector || []).includes(v);
      state.depthRange = null;
      state.valueRange = null;
      ["depth-min","depth-max","speed-min","speed-max"].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = "";
      });
      const cfg = state.varConfig[v];
      state.colorRange = cfg ? [cfg.min, cfg.max] : null;
      _syncConfigUI(v);
      _updateVarLabels(v);
      _updateVolTitle(v);
      _apply2DMode();
      if (state.varType === "3d") renderVolume();
      renderLayer(state.depthIdx, state.points);
      renderProfile();
    });
  });

  // Collapsible var groups
  document.querySelectorAll(".var-group-header").forEach(header => {
    header.addEventListener("click", () => {
      const groupId = header.dataset.group;
      const body    = document.getElementById(`var-group-${groupId}`);
      const arrow   = header.querySelector(".var-group-arrow");
      const isOpen  = !body.classList.contains("hidden");
      body.classList.toggle("hidden", isOpen);
      if (arrow) arrow.textContent = isOpen ? "▶" : "▼";
    });
  });

  // Depth select + slider
  const depthSelect = document.getElementById("depth-select");
  const depthSlider = document.getElementById("depth-slider");
  depthSelect.innerHTML = "";
  state.meta.depths.forEach((d, i) => {
    const opt = document.createElement("option");
    opt.value       = i;
    opt.textContent = `${d.toFixed(1)} m`;
    depthSelect.appendChild(opt);
  });
  depthSlider.min   = 0;
  depthSlider.max   = state.meta.depths.length - 1;
  depthSlider.value = 0;

  let _depthDebounceTimer = null;
  function _debouncedDepthChange(i, delay = 120) {
    clearTimeout(_depthDebounceTimer);
    _depthDebounceTimer = setTimeout(() => onDepthChange(i), delay);
  }

  depthSelect.addEventListener("change", () => {
    const i = parseInt(depthSelect.value);
    depthSlider.value = i;
    onDepthChange(i);
  });
  depthSlider.addEventListener("input", () => {
    const i = parseInt(depthSlider.value);
    depthSelect.value = i;
    _debouncedDepthChange(i);
  });

  // Mode radio
  document.querySelectorAll('input[name="mode"]').forEach((radio) => {
    radio.checked = radio.value === "point";
    radio.addEventListener("change", () => {
      state.mode   = radio.value;
      state.points = [];
      document.getElementById("mode-point").classList.toggle("active", state.mode === "point");
      document.getElementById("mode-transect").classList.toggle("active", state.mode === "transect");
      renderLayer(state.depthIdx, []);
      renderProfile();
    });
  });
  state.mode = "point";

  // Clear button
  document.getElementById("clear-btn").onclick = () => {
    state.points = [];
    renderLayer(state.depthIdx, []);
    renderProfile();
  };

  // Range controls
  document.getElementById("range-apply-btn").onclick = () => {
    const dMin = parseFloat(document.getElementById("depth-min").value);
    const dMax = parseFloat(document.getElementById("depth-max").value);
    const vMin = parseFloat(document.getElementById("speed-min").value);
    const vMax = parseFloat(document.getElementById("speed-max").value);
    state.depthRange = (!isNaN(dMin) && !isNaN(dMax)) ? [dMin, dMax] : null;
    state.valueRange = (!isNaN(vMin) && !isNaN(vMax)) ? [vMin, vMax] : null;
    renderProfile();
  };

  document.getElementById("range-reset-btn").onclick = () => {
    state.depthRange = null;
    state.valueRange = null;
    ["depth-min","depth-max","speed-min","speed-max"].forEach(id => {
      document.getElementById(id).value = "";
    });
    renderProfile();
  };
  // Colorbar range — unified control
  document.getElementById("cbar-apply").onclick = async () => {
    const cmin    = parseFloat(document.getElementById("cmin").value);
    const cmax    = parseFloat(document.getElementById("cmax").value);
    const cs      = document.getElementById("colorscale-select").value;
    const cMinHex = document.getElementById("color-min-hex").value.trim();
    const cMaxHex = document.getElementById("color-max-hex").value.trim();
    const hexRe   = /^#[0-9a-fA-F]{6}$/;
    const hasCustom = hexRe.test(cMinHex) && hexRe.test(cMaxHex);

    if (!isNaN(cmin) && !isNaN(cmax)) {
      state.varConfig[state.variable] = {
        min: cmin, max: cmax,
        colorscale:  hasCustom ? null : (cs || VAR_DEFAULTS[state.variable].colorscale),
        color_min:   hasCustom ? cMinHex : null,
        color_max:   hasCustom ? cMaxHex : null,
      };
      state.colorRange = [cmin, cmax];
      state.valueRange = [cmin, cmax];
      document.getElementById("speed-min").value = cmin;
      document.getElementById("speed-max").value = cmax;
      try { await apiFetch("/api/config", { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify(state.varConfig) }); } catch {}
      renderVolume();
      renderLayer(state.depthIdx, state.points);
      renderProfile();
    }
  };

  // Render charts
  const timelineCard = document.getElementById("timeline-card");
  const dateSelect   = document.getElementById("date-select");
  const dateSlider   = document.getElementById("date-slider");
  const dateIndexEl  = document.getElementById("date-index");
  const dateTotalEl  = document.getElementById("date-total");
  const playBtn      = document.getElementById("play-btn");

  if (state.isSeries && state.dates.length > 1) {
    timelineCard.style.display = "";
    dateSelect.innerHTML = "";
    state.dates.forEach((d, i) => {
      const opt = document.createElement("option");
      opt.value = i;
      opt.textContent = `${d.slice(0,4)}-${d.slice(4,6)}-${d.slice(6,8)}`;
      dateSelect.appendChild(opt);
    });
    dateSlider.max   = state.dates.length - 1;
    dateSlider.value = 0;
    dateTotalEl.textContent = `共 ${state.dates.length} 帧`;
    dateIndexEl.textContent = `第 1 帧`;

    let _dateDebounceTimer = null;
    function _debouncedDateChange(i, delay = 150) {
      clearTimeout(_dateDebounceTimer);
      _dateDebounceTimer = setTimeout(() => onDateChange(i), delay);
    }

    dateSelect.addEventListener("change", () => {
      const i = parseInt(dateSelect.value);
      dateSlider.value = i;
      onDateChange(i);
    });
    dateSlider.addEventListener("input", () => {
      const i = parseInt(dateSlider.value);
      dateSelect.value = i;
      _debouncedDateChange(i);
    });

    if (playBtn._playHandler) playBtn.removeEventListener("click", playBtn._playHandler);
    playBtn._playHandler = () => {
      if (state.playing) stopPlayback();
      else startPlayback();
    };
    playBtn.addEventListener("click", playBtn._playHandler);
  } else {
    timelineCard.style.display = "none";
  }

  await Promise.all([renderVolume(), renderLayer(0)]);
  _apply2DMode();

  const empty = emptyFigure("在右侧地图点击选点，查看垂直剖面或断面");
  Plotly.newPlot("profile-graph", empty.data, empty.layout, PLOTLY_CONFIG);
  setProfileTitle("剖面 / 断面");

  initMapDrag();
}

// ---------------------------------------------------------------------------
// Chart renderers
// ---------------------------------------------------------------------------

async function renderVolume() {
  if (state.varType === "2d") return;  // 2D variables have no volume view
  const cfg = state.varConfig[state.variable] || {};
  const params = new URLSearchParams({ variable: state.variable });
  if (state.colorRange) {
    params.set("cmin", state.colorRange[0]);
    params.set("cmax", state.colorRange[1]);
  }
  if (cfg.color_min && cfg.color_max) {
    params.set("color_min", cfg.color_min);
    params.set("color_max", cfg.color_max);
  } else if (cfg.colorscale) {
    params.set("colorscale", cfg.colorscale);
  }
  if (state.isSeries) params.set("date_idx", state.dateIdx);
  const data = await apiFetch(`/api/volume?${params}`);
  Plotly.react("vol-graph", data.data, data.layout, PLOTLY_CONFIG);

  // Re-attach click handler (react may replace the element)
  document.getElementById("vol-graph").removeAllListeners &&
    document.getElementById("vol-graph").removeAllListeners("plotly_click");
  document.getElementById("vol-graph").on("plotly_click", (evt) => {
    if (!evt || !evt.points || !evt.points.length) return;
    const curveNumber = evt.points[0].curveNumber;
    if (curveNumber >= 0 && curveNumber < state.meta.depths.length) {
      document.getElementById("depth-select").value = curveNumber;
      document.getElementById("depth-slider").value = curveNumber;
      onDepthChange(curveNumber);
    }
  });
}

async function renderLayer(depthIdx, points = []) {
  const cfg = state.varConfig[state.variable] || {};
  const params = new URLSearchParams({ variable: state.variable });
  if (points.length) params.set("points", JSON.stringify(points));
  if (state.colorRange) {
    params.set("cmin", state.colorRange[0]);
    params.set("cmax", state.colorRange[1]);
  }
  if (cfg.color_min && cfg.color_max) {
    params.set("color_min", cfg.color_min);
    params.set("color_max", cfg.color_max);
  } else if (cfg.colorscale) {
    params.set("colorscale", cfg.colorscale);
  }
  if (state.isSeries) params.set("date_idx", state.dateIdx);
  if (state.isVector) params.set("step", state.quiverStep);
  // For 2D variables depth_idx is ignored by the backend but still required in the URL
  const urlDepthIdx = state.varType === "2d" ? 0 : depthIdx;
  const data = await apiFetch(`/api/layer/${urlDepthIdx}?${params}`);

  // Preserve current zoom/pan before react() resets the layout
  const gd = document.getElementById("layer-map-graph");
  let savedRange = null;
  if (gd._fullLayout) {
    const xa = gd._fullLayout.xaxis;
    const ya = gd._fullLayout.yaxis;
    if (xa && ya && !xa.autorange && !ya.autorange) {
      savedRange = {
        "xaxis.range": [...xa.range],
        "yaxis.range": [...ya.range],
      };
    }
  }

  Plotly.react("layer-map-graph", data.figure.data, data.figure.layout, PLOTLY_CONFIG_MAP);

  if (savedRange) {
    Plotly.relayout("layer-map-graph", savedRange);
  }

  document.getElementById("layer-panel-title").textContent = data.title;

  attachMapClick();
}

async function renderProfile() {
  if (!state.points.length) {
    const empty = emptyFigure("在右侧地图点击选点，查看垂直剖面或断面");
    Plotly.react("profile-graph", empty.data, empty.layout, PLOTLY_CONFIG);
    setProfileTitle("剖面 / 断面");
    setClickInfo("");
    return;
  }

  // 2D variables have no vertical profile — show click info only
  if (state.varType === "2d") {
    const p = state.points[state.points.length - 1];
    const empty = emptyFigure(`${VAR_LABELS[state.variable] || state.variable} 为表面层变量，无垂直剖面`);
    Plotly.react("profile-graph", empty.data, empty.layout, PLOTLY_CONFIG);
    setProfileTitle(`${VAR_LABELS[state.variable] || state.variable} · 表面层`);
    setClickInfo(`${p.lat.toFixed(3)}°N, ${p.lon.toFixed(3)}°E`);
    return;
  }

  if (state.mode === "point") {
    const p = state.points[state.points.length - 1];
    const data = await apiFetch("/api/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lat: p.lat, lon: p.lon,
        depth_idx:   state.depthIdx,
        variable:    state.variable,
        depth_range: state.depthRange,
        value_range: state.valueRange,
        date_idx:    state.dateIdx,
      }),
    });
    Plotly.react("profile-graph", data.figure.data, data.figure.layout, PLOTLY_CONFIG);
    setProfileTitle(data.title);
    setClickInfo(data.info);

  } else {
    if (state.points.length < 2) {
      const empty = emptyFigure("再点击一个点完成断面选取");
      Plotly.react("profile-graph", empty.data, empty.layout, PLOTLY_CONFIG);
      setProfileTitle("断面");
      const p1 = state.points[0];
      setClickInfo(`P1: ${p1.lat.toFixed(2)}°N, ${p1.lon.toFixed(2)}°E — 等待 P2`);
      return;
    }
    const [p1, p2] = state.points;
    const data = await apiFetch("/api/transect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        p1: { lat: p1.lat, lon: p1.lon },
        p2: { lat: p2.lat, lon: p2.lon },
        depth_idx:   state.depthIdx,
        variable:    state.variable,
        depth_range: state.depthRange,
        value_range: state.valueRange,
        date_idx:    state.dateIdx,
      }),
    });
    Plotly.react("profile-graph", data.figure.data, data.figure.layout, PLOTLY_CONFIG);
    setProfileTitle(data.title);
    setClickInfo(data.info);
  }
}

function emptyFigure(msg) {
  return {
    data: [],
    layout: {
      paper_bgcolor: "#ffffff",
      plot_bgcolor:  "#f8fafc",
      font:   { color: "#334155" },
      margin: { l: 10, r: 10, t: 10, b: 10 },
      xaxis:  { visible: false },
      yaxis:  { visible: false },
      annotations: [{
        text: msg, x: 0.5, y: 0.5,
        xref: "paper", yref: "paper",
        showarrow: false,
        font: { size: 13, color: "#94a3b8" },
      }],
    },
  };
}

// ---------------------------------------------------------------------------
// Event handlers
// ---------------------------------------------------------------------------

function attachMapClick() {
  const el = document.getElementById("layer-map-graph");
  el.removeAllListeners && el.removeAllListeners("plotly_click");
  el.removeAllListeners && el.removeAllListeners("plotly_hover");
  el.removeAllListeners && el.removeAllListeners("plotly_unhover");

  el.on("plotly_hover", (evt) => {
    if (!evt || !evt.points || !evt.points.length) return;
    const pt = evt.points[0];
    if (pt.curveNumber === 1) {
      state.drag.hoverPointIdx = pt.pointIndex;
      el.style.cursor = "grab";
    } else {
      state.drag.hoverPointIdx = null;
      if (!state.drag.active) el.style.cursor = "";
    }
  });

  el.on("plotly_unhover", () => {
    if (!state.drag.active) {
      state.drag.hoverPointIdx = null;
      el.style.cursor = "";
    }
  });

  el.on("plotly_click", async (evt) => {
    if (state.drag.active) return;
    if (!evt || !evt.points || !evt.points.length) return;
    const pt = evt.points[0];
    if (pt.x == null || pt.y == null) return;
    if (pt.curveNumber >= 1) return;  // ignore clicks on marker/line traces

    const newPt = { lat: pt.y, lon: pt.x };
    if (state.mode === "point") {
      state.points = [newPt];
    } else {
      state.points = [...state.points, newPt].slice(-2);
    }

    await renderLayer(state.depthIdx, state.points);
    await renderProfile();
  });
}

function initMapDrag() {
  const el = document.getElementById("layer-map-graph");

  el.addEventListener("mousedown", (e) => {
    if (state.drag.hoverPointIdx === null) return;
    e.stopPropagation();
    e.preventDefault();
    state.drag.active   = true;
    state.drag.pointIdx = state.drag.hoverPointIdx;
    el.style.cursor = "grabbing";
    document.body.style.userSelect = "none";

    function onMove(e) {
      if (!state.drag.active) return;
      const { lat, lon } = _pixelToLatLon(el, e.clientX, e.clientY);
      state.points[state.drag.pointIdx] = { lat, lon };
      _updateMapMarkers();
      _debouncedRenderProfile(150);
    }

    function onUp() {
      state.drag.active = false;
      el.style.cursor = state.drag.hoverPointIdx !== null ? "grab" : "";
      document.body.style.userSelect = "";
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      clearTimeout(_profileDebounceTimer);
      renderLayer(state.depthIdx, state.points);
      renderProfile();
    }

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, { capture: true });
}

async function onDepthChange(depthIdx) {
  state.depthIdx = depthIdx;
  const total = state.meta.depths.length;
  const el = document.getElementById("depth-index");
  if (el) el.textContent = `第 ${depthIdx + 1} / ${total} 层`;
  await Promise.all([renderLayer(depthIdx, state.points), renderProfile()]);
}

async function onDateChange(dateIdx) {
  state.dateIdx = dateIdx;
  const el = document.getElementById("date-index");
  if (el) el.textContent = `第 ${dateIdx + 1} 帧`;
  const dateSelect = document.getElementById("date-select");
  const dateSlider = document.getElementById("date-slider");
  if (dateSelect) dateSelect.value = dateIdx;
  if (dateSlider) dateSlider.value = dateIdx;
  const renders = [renderLayer(state.depthIdx, state.points)];
  if (!state.playing) renders.push(renderVolume());
  await Promise.all(renders);
  await renderProfile();
}

function startPlayback() {
  state.playing = true;
  const playBtn    = document.getElementById("play-btn");
  const playStatus = document.getElementById("play-status");
  if (playBtn) { playBtn.textContent = "⏹ 停止"; playBtn.classList.add("playing"); }

  function tick() {
    if (!state.playing) return;
    const next = (state.dateIdx + 1) % state.dates.length;
    if (state.playing) state.playTimer = setTimeout(tick, 3000);
    onDateChange(next);
  }
  state.playTimer = setTimeout(tick, 3000);
  if (playStatus) playStatus.textContent = "3s / 帧";
}

function stopPlayback() {
  state.playing = false;
  clearTimeout(state.playTimer);
  state.playTimer = null;
  const playBtn    = document.getElementById("play-btn");
  const playStatus = document.getElementById("play-status");
  if (playBtn) { playBtn.textContent = "▶ 播放"; playBtn.classList.remove("playing"); }
  if (playStatus) playStatus.textContent = "";
}

// ---------------------------------------------------------------------------
// Panel resizer
// ---------------------------------------------------------------------------

function initResizer() {
  const resizer = document.getElementById("resizer");
  const left    = document.getElementById("panel-3d");
  const right   = document.getElementById("panel-map");

  let startX, startLeftW, startRightW;

  resizer.addEventListener("mousedown", (e) => {
    e.preventDefault();
    startX      = e.clientX;
    startLeftW  = left.getBoundingClientRect().width;
    startRightW = right.getBoundingClientRect().width;
    resizer.classList.add("dragging");
    document.body.style.cursor     = "col-resize";
    document.body.style.userSelect = "none";

    const volEl     = document.getElementById("vol-graph");
    const mapEl     = document.getElementById("layer-map-graph");
    const sidebarEl = document.querySelector(".sidebar");
    volEl.style.pointerEvents     = "none";
    mapEl.style.pointerEvents     = "none";
    sidebarEl.style.pointerEvents = "none";

    let rafId = null;

    function onMove(e) {
      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        const dx       = e.clientX - startX;
        const total    = startLeftW + startRightW;
        const newLeft  = Math.max(200, Math.min(total - 200, startLeftW + dx));
        const newRight = total - newLeft;
        left.style.flex  = "none";
        left.style.width = newLeft + "px";
        right.style.flex  = "none";
        right.style.width = newRight + "px";
      });
    }

    function onUp() {
      if (rafId) cancelAnimationFrame(rafId);
      resizer.classList.remove("dragging");
      document.body.style.cursor     = "";
      document.body.style.userSelect = "";
      volEl.style.pointerEvents     = "";
      mapEl.style.pointerEvents     = "";
      sidebarEl.style.pointerEvents = "";
      Plotly.Plots.resize(volEl);
      Plotly.Plots.resize(mapEl);
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    }

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  });
}

function initSidebarResizer() {
  const resizer    = document.getElementById("sidebar-resizer");
  const sidebar    = document.querySelector(".sidebar");
  const chartsCol  = document.querySelector(".charts-col");

  let startX, startW;

  resizer.addEventListener("mousedown", (e) => {
    e.preventDefault();
    startX = e.clientX;
    startW = sidebar.getBoundingClientRect().width;
    document.body.style.cursor     = "col-resize";
    document.body.style.userSelect = "none";
    sidebar.style.pointerEvents    = "none";

    let rafId = null;

    function onMove(e) {
      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        const newW = Math.max(180, Math.min(480, startW + (e.clientX - startX)));
        sidebar.style.width = newW + "px";
      });
    }

    function onUp() {
      if (rafId) cancelAnimationFrame(rafId);
      document.body.style.cursor     = "";
      document.body.style.userSelect = "";
      sidebar.style.pointerEvents    = "";
      const volEl = document.getElementById("vol-graph");
      const mapEl = document.getElementById("layer-map-graph");
      if (volEl) Plotly.Plots.resize(volEl);
      if (mapEl) Plotly.Plots.resize(mapEl);
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    }

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  });
}

function initRowResizer() {
  const resizer  = document.getElementById("row-resizer");
  const topRow   = document.getElementById("main-row");
  const profPanel = document.querySelector(".panel-profile");

  let startY, startTopH, startBotH;

  resizer.addEventListener("mousedown", (e) => {
    e.preventDefault();
    startY     = e.clientY;
    startTopH  = topRow.getBoundingClientRect().height;
    startBotH  = profPanel.getBoundingClientRect().height;
    document.body.style.cursor     = "row-resize";
    document.body.style.userSelect = "none";

    const volEl  = document.getElementById("vol-graph");
    const mapEl  = document.getElementById("layer-map-graph");
    const profEl = document.getElementById("profile-graph");
    volEl.style.pointerEvents  = "none";
    mapEl.style.pointerEvents  = "none";
    profEl.style.pointerEvents = "none";

    let rafId = null;

    function onMove(e) {
      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        const dy      = e.clientY - startY;
        const newTop  = Math.max(150, startTopH + dy);
        const newBot  = Math.max(120, startBotH - dy);
        topRow.style.flex   = "none";
        topRow.style.height = newTop + "px";
        profPanel.style.flex   = "none";
        profPanel.style.height = newBot + "px";
      });
    }

    function onUp() {
      if (rafId) cancelAnimationFrame(rafId);
      document.body.style.cursor     = "";
      document.body.style.userSelect = "";
      volEl.style.pointerEvents  = "";
      mapEl.style.pointerEvents  = "";
      profEl.style.pointerEvents = "";
      Plotly.Plots.resize(volEl);
      Plotly.Plots.resize(mapEl);
      Plotly.Plots.resize(profEl);
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    }

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  });
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

document.addEventListener("DOMContentLoaded", () => {
  initUploadScreen();
  initResizer();
  initSidebarResizer();
  initRowResizer();

  fetch("/api/status").then(r => r.json()).then(async s => {
    if (s.ready) {
      document.getElementById("upload-screen").classList.add("hidden");
      document.getElementById("main-screen").classList.remove("hidden");
      document.getElementById("loaded-filename").textContent = "（命令行预加载）";
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      initMainScreen();
    }
  });
});
