/**
 * Pisces-Explorer application entry and cross-feature rendering coordinator.
 */

const state = SessionStore.state;
const VAR_LABELS = VariableRegistry.labels;
const VAR_UNITS = VariableRegistry.units;
const VAR_DEFAULTS = VariableRegistry.configurableDefaults;
const COLORSCALES = VariableRegistry.colorscales;
const PLOTLY_CONFIG = PlotlyConfig.chart;
const PLOTLY_CONFIG_MAP = PlotlyConfig.map;
const apiFetch = ApiClient.fetchJson;


function setClickInfo(text) {
  document.getElementById("map-click-info").textContent = text;
}


function setProfileTitle(text) {
  document.getElementById("profile-panel-title").textContent = text;
}


function setUploadStatus(message, type = "") {
  const element = document.getElementById("upload-status");
  element.textContent = message;
  element.className = `upload-status${type ? ` ${type}` : ""}`;
}


function handleExpiredData(error) {
  const comparisonMissing = (
    error?.status === 400
    && error?.detail === "No comparison series loaded."
  );
  if (!comparisonMissing && error?.status !== 503) return false;

  stopPlayback();
  ComparisonView.reset();
  SessionStore.resetDataSession();
  UploadController.showEmptyWorkspace();
  setUploadStatus(
    "后端已重启，内存中的数据已清空，请重新选择 NetCDF 文件。",
    "error"
  );
  return true;
}


async function initMainScreen() {
  return WorkspaceController.initialize({
    state,
    apiFetch,
    defaults: VAR_DEFAULTS,
    labels: VAR_LABELS,
    units: VAR_UNITS,
    colorscales: COLORSCALES,
    plotConfig: PLOTLY_CONFIG,
    renderVolume,
    renderLayer,
    renderProfile,
    initializePanels,
    onDepthChange,
    onDateChange,
    emptyFigure,
    setProfileTitle,
  });
}


async function renderVolume() {
  return PanelController.renderAll();
}


function initializePanels() {
  PanelController.initialize({
    state,
    fetchJson: apiFetch,
    plotConfig: PLOTLY_CONFIG,
    mapPlotConfig: PLOTLY_CONFIG_MAP,
    onDepthChange,
    renderProfile,
    handleExpiredData,
  });
}


async function renderLayer(depthIndex, points = []) {
  return PanelController.renderAll();
}


async function renderProfile() {
  if (!state.meta) return;
  const loading = document.getElementById("profile-loading");
  if (loading && !state.playing) loading.classList.remove("hidden");
  try {
    if (!state.points.length) {
      renderEmptyAnalysis();
      return;
    }
    if (state.varType === "2d") {
      renderSurfaceVariableInfo();
      return;
    }
    if (state.mode === "point") {
      await ProfileView.render({
        state,
        fetchJson: apiFetch,
        plotConfig: PLOTLY_CONFIG,
        setTitle: setProfileTitle,
        setInfo: setClickInfo,
      });
      return;
    }
    if (state.points.length < 2) {
      renderWaitingForSecondPoint();
      return;
    }
    await TransectView.render({
      state,
      fetchJson: apiFetch,
      plotConfig: PLOTLY_CONFIG,
      setTitle: setProfileTitle,
      setInfo: setClickInfo,
    });
  } finally {
    loading?.classList.add("hidden");
  }
}


function renderEmptyAnalysis() {
  const modeName = (
    state.mode === "point" ? "单点垂直剖面" : "两点垂直断面"
  );
  const empty = emptyFigure(
    state.mode === "point"
      ? "请在上方地图选择一个位置"
      : "请在上方地图依次选择 P1 和 P2"
  );
  Plotly.react("profile-graph", empty.data, empty.layout, PLOTLY_CONFIG);
  const sourceLabel = (
    state.comparisonSource === "a" ? "序列 A"
      : state.comparisonSource === "b" ? "序列 B"
        : "差值 A − B"
  );
  setProfileTitle(
    state.isComparison
      ? `${modeName}对比 · 当前展示 ${sourceLabel}`
      : modeName
  );
  setClickInfo("");
}


function renderSurfaceVariableInfo() {
  const point = state.points[state.points.length - 1];
  const label = VAR_LABELS[state.variable] || state.variable;
  const empty = emptyFigure(`${label} 为表面层变量，无垂直剖面`);
  Plotly.react("profile-graph", empty.data, empty.layout, PLOTLY_CONFIG);
  setProfileTitle(`${label} · 表面层`);
  setClickInfo(`${point.lat.toFixed(3)}°N, ${point.lon.toFixed(3)}°E`);
}


function renderWaitingForSecondPoint() {
  const empty = emptyFigure("请在上方地图再选择一个位置作为 P2");
  Plotly.react("profile-graph", empty.data, empty.layout, PLOTLY_CONFIG);
  setProfileTitle(
    state.isComparison
      ? "两点垂直断面对比 · 等待选择 P2"
      : "两点垂直断面 · 等待选择 P2"
  );
  const firstPoint = state.points[0];
  setClickInfo(
    `P1: ${firstPoint.lat.toFixed(2)}°N, `
    + `${firstPoint.lon.toFixed(2)}°E — 等待 P2`
  );
}


function emptyFigure(message) {
  return {
    data: [],
    layout: {
      paper_bgcolor: "#ffffff",
      plot_bgcolor: "#f8fafc",
      font: { color: "#334155" },
      margin: { l: 10, r: 10, t: 10, b: 10 },
      xaxis: { visible: false },
      yaxis: { visible: false },
      annotations: [{
        text: message,
        x: 0.5,
        y: 0.5,
        xref: "paper",
        yref: "paper",
        showarrow: false,
        font: { size: 13, color: "#94a3b8" },
      }],
    },
  };
}


async function onDepthChange(depthIndex) {
  state.depthIdx = depthIndex;
  const total = state.meta.depths.length;
  document.getElementById(
    "depth-index"
  ).textContent = `第 ${depthIndex + 1} / ${total} 层`;
  await Promise.all([
    renderLayer(depthIndex, state.points),
    renderProfile(),
  ]);
}


async function onDateChange(dateIndex) {
  state.dateIdx = dateIndex;
  document.getElementById("date-index").textContent = `第 ${dateIndex + 1} 帧`;
  document.getElementById("date-select").value = dateIndex;
  document.getElementById("date-slider").value = dateIndex;
  await renderLayer(state.depthIdx, state.points);
  await renderProfile();
}


function startPlayback() {
  TimelineController.start();
}


function stopPlayback() {
  TimelineController.stop();
}


document.addEventListener("DOMContentLoaded", () => {
  UploadController.init();
  SidebarController.initialize();
  SidebarSections.initialize();
  PanelResizer.initAll();

  fetch("/api/status")
    .then(response => response.json())
    .then(async status => {
      if (!status.ready) {
        UploadController.showEmptyWorkspace();
        return;
      }
      UploadController.showWorkspace();
      document.getElementById(
        "loaded-filename"
      ).textContent = "（命令行预加载）";
      const detectedMode = document.getElementById("detected-load-mode");
      detectedMode.textContent = "当前使用命令行预加载数据";
      detectedMode.classList.add("valid");
      await new Promise(resolve => {
        requestAnimationFrame(() => requestAnimationFrame(resolve));
      });
      await initMainScreen();
    });
});
