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
const apiFetch = PlaybackCache.fetchJson;


function setClickInfo(text) {
  document.getElementById("map-click-info").textContent = text;
}


function setProfileTitle(text) {
  const title = document.getElementById("profile-panel-title");
  title.textContent = text;
  title.title = text;
  const badge = document.getElementById("analysis-source-badge");
  if (!badge) return;
  const labels = { a: "序列 A", b: "序列 B", difference: "差值 A−B" };
  badge.textContent = labels[state.comparisonSource] || "";
  badge.classList.toggle("hidden", !state.isComparison);
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

function playbackRequests(dateIndex) {
  const requests = PanelController.playbackRequests(dateIndex);
  if (!state.points.length || state.varType === "2d") return requests;
  if (state.mode === "point") {
    requests.push(ProfileView.request(state, dateIndex));
  } else if (state.points.length >= 2) {
    requests.push(TransectView.request(state, dateIndex));
  }
  return requests;
}


async function preparePlayback(onProgress, shouldContinue) {
  const frameRequests = state.dates.map(
    (_date, dateIndex) => playbackRequests(dateIndex)
  );
  return PlaybackCache.preloadFrames(
    frameRequests,
    onProgress,
    shouldContinue,
  );
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
    preparePlayback,
    emptyFigure,
    setProfileTitle,
  });
}


async function renderVolume() {
  return PanelController.renderActive();
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
    onActivate: WorkspaceController.syncActivePanel,
  });
}


async function renderLayer(depthIndex, points = []) {
  return PanelController.renderActive();
}


async function renderProfile() {
  if (!state.meta) return;
  PiscesUIEvents.panel(state);
  const loading = document.getElementById("profile-loading");
  if (loading && !state.playing) loading.classList.remove("hidden");
  try {
    if (!state.points.length) {
      await renderEmptyAnalysis();
      return;
    }
    if (state.varType === "2d") {
      await renderSurfaceVariableInfo();
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
      await renderWaitingForSecondPoint();
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


async function renderEmptyAnalysis() {
  const modeName = (
    state.mode === "point" ? "单点垂直剖面" : "两点垂直断面"
  );
  const empty = emptyFigure(
    state.mode === "point"
      ? "请在上方地图选择一个位置"
      : "请在上方地图依次选择 P1 和 P2"
  );
  await Plotly.react(
    "profile-graph", empty.data, empty.layout, PLOTLY_CONFIG
  );
  setProfileTitle(modeName);
  setClickInfo("");
}


async function renderSurfaceVariableInfo() {
  const point = state.points[state.points.length - 1];
  const label = VAR_LABELS[state.variable] || state.variable;
  const empty = emptyFigure(`${label} 为表面层变量，无垂直剖面`);
  await Plotly.react(
    "profile-graph", empty.data, empty.layout, PLOTLY_CONFIG
  );
  setProfileTitle(`${label} · 表面层`);
  setClickInfo(`${point.lat.toFixed(3)}°N, ${point.lon.toFixed(3)}°E`);
}


async function renderWaitingForSecondPoint() {
  const empty = emptyFigure("请在上方地图再选择一个位置作为 P2");
  await Plotly.react(
    "profile-graph", empty.data, empty.layout, PLOTLY_CONFIG
  );
  setProfileTitle("两点垂直断面 · 等待选择 P2");
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


async function onDepthChange(depthIndex, slotId = null) {
  const linkedDepthClick = state.linked3d2d && slotId === "left";
  if (slotId && slotId !== state.activeAnalysisSlot && !linkedDepthClick) {
    SessionStore.activate(slotId);
    await WorkspaceController.syncActivePanel();
  }
  if (state.playing || state.preparingPlayback) {
    await TimelineController.stop({ waitForActive: true });
  }
  const depthSource = slotId || state.activeAnalysisSlot;
  SessionStore.forPanel(depthSource).depthIdx = depthIndex;
  if (state.linked3d2d) {
    SessionStore.syncLinked(depthSource, ["depthIdx"]);
  }
  await RangeControls.save(apiFetch);
  const total = state.meta.depths.length;
  document.getElementById(
    "depth-index"
  ).textContent = `第 ${depthIndex + 1} / ${total} 层`;
  PiscesUIEvents.panel(state);
  if (state.linked3d2d) {
    await PanelController.renderSlot("right");
    return;
  }
  const activeSlot = state.activeAnalysisSlot;
  const activeView = state.panelSlots[activeSlot]?.viewType;
  if (PanelRegistry.definitions[activeView]?.volume) return;
  await Promise.all([
    renderLayer(depthIndex, state.points),
    renderProfile(),
  ]);
}


async function onDateChange(dateIndex) {
  state.dateIdx = dateIndex;
  if (state.linked3d2d) {
    SessionStore.syncLinked(state.activeAnalysisSlot, ["dateIdx"]);
  }
  document.getElementById("date-index").textContent = `第 ${dateIndex + 1} 帧`;
  document.getElementById("date-select").value = dateIndex;
  document.getElementById("date-slider").value = dateIndex;
  await RangeControls.save(apiFetch);
  PiscesUIEvents.panel(state);
  if (state.linked3d2d) await PanelController.renderAll();
  else await renderLayer(state.depthIdx, state.points);
  await renderProfile();
}


function startPlayback() {
  TimelineController.start();
}


function stopPlayback() {
  TimelineController.stop();
}


let explorerApplicationInitialized = false;

function initializeExplorerApplication() {
  if (explorerApplicationInitialized) return;
  explorerApplicationInitialized = true;
  UploadController.init();
  if (!document.getElementById("explorer-vue-sidebar")) {
    SidebarController.initialize();
    SidebarSections.initialize();
  }
  PanelResizer.initAll();

  ApiClient.fetchJson("/api/status")
    .then(async status => {
      await UploadController.restoreSession(status);
    });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeExplorerApplication);
} else {
  initializeExplorerApplication();
}
