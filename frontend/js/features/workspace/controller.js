/**
 * Load one analysis session and compose its independent UI controllers.
 */
const WorkspaceController = (() => {
  let activeControlContext = null;

  function setText(id, text) {
    const element = document.getElementById(id);
    if (element) element.textContent = text;
  }

  function renderComparisonFiles(state) {
    const card = document.getElementById("comparison-files-card");
    const list = document.getElementById("comparison-files-list");
    const files = state.comparisonFiles || [];
    card.classList.toggle("hidden", !state.isComparison || !files.length);
    list.innerHTML = "";
    files.forEach(item => {
      const row = document.createElement("div");
      row.className = "comparison-file-row";
      [item.date, item.a, item.b].forEach((text, index) => {
        const cell = document.createElement("span");
        cell.textContent = text || "—";
        if (index > 0) {
          cell.className = "comparison-file-name";
          cell.title = text || "";
        }
        row.appendChild(cell);
      });
      list.appendChild(row);
    });
  }

  function initializeState(state, metadata, series, defaults) {
    state.meta = metadata;
    state.isSeries = series.is_series;
    state.isComparison = series.is_comparison;
    state.comparisonFiles = series.comparison_files || [];
    state.dates = series.dates;
    state.dateIdx = 0;
    state.configLoaded = false;
    ["left", "right"].forEach(slotId => {
      const panel = SessionStore.forPanel(slotId);
      panel.points = [];
      panel.pointsByMode = { point: [], transect: [] };
      panel.depthIdx = 0;
      panel.dateIdx = 0;
      panel.depthRange = null;
      panel.valueRange = null;
      panel.comparisonSource = "a";
    });
  }

  function updateMetadata(metadata) {
    setText(
      "meta-lon",
      `${metadata.lon_range[0].toFixed(1)}° – `
      + `${metadata.lon_range[1].toFixed(1)}°`
    );
    setText(
      "meta-lat",
      `${metadata.lat_range[0].toFixed(1)}° – `
      + `${metadata.lat_range[1].toFixed(1)}°`
    );
    setText("meta-depths", `${metadata.depths.length} 层`);
    setText("meta-grid", metadata.grid_shape?.join(" × ") || "--");
    const displayGridItem = document.getElementById("meta-display-grid-item");
    if (displayGridItem) {
      const hasDisplayGrid = Number.isFinite(metadata.display_resolution_km);
      setText("meta-grid-label", hasDisplayGrid ? "原始网格" : "网格尺寸");
      displayGridItem.classList.toggle("hidden", !hasDisplayGrid);
      setText(
        "meta-display-grid",
        hasDisplayGrid
          ? `${metadata.display_resolution_km} km 插值 · ${metadata.display_grid_shape.join(" × ")}`
          : "--"
      );
    }
    setText("depth-index", `第 1 / ${metadata.depths.length} 层`);
    setText("depth-total", `共 ${metadata.depths.length} 层`);
  }

  async function initialize({
    state,
    apiFetch,
    defaults,
    labels,
    units,
    colorscales,
    plotConfig,
    renderVolume,
    renderLayer,
    renderProfile,
    initializePanels,
    onDepthChange,
    onDateChange,
    preparePlayback,
    emptyFigure,
    setProfileTitle,
  }) {
    const metadata = await apiFetch("/api/meta");
    VariableRegistry.hydrate(metadata.variable_registry);
    const series = await apiFetch("/api/dates");
    initializeState(state, metadata, series, defaults);
    initializePanels();
    MapSelection.configure({
      state,
      renderLayer,
      renderProfile,
      onDragStart: TimelineController.stop,
      onRegionSelected: region => RegionControls.applyRegion(region, "map"),
    });

    renderComparisonFiles(state);
    updateMetadata(metadata);

    activeControlContext = {
      state,
      apiFetch,
      defaults,
      labels,
      units,
      colorscales,
      renderVolume,
      renderLayer,
      renderProfile,
      onDepthChange,
      onDateChange,
      preparePlayback,
    };
    await syncActivePanel();
    PanelController.refreshSelectors();
    await PanelController.renderAll();
    const empty = emptyFigure("请在上方地图选择一个位置");
    Plotly.newPlot(
      "profile-graph", empty.data, empty.layout, plotConfig
    );
    setProfileTitle(
      "单点垂直剖面"
    );
    MapSelection.initDrag();

    const collapseButton = document.getElementById("analysis-collapse");
    collapseButton.onclick = async () => {
      state.analysisCollapsed = !state.analysisCollapsed;
      applyAnalysisCollapse(state);
      await RangeControls.save(apiFetch);
    };
  }

  function applyAnalysisCollapse(state) {
    const panel = document.getElementById("analysis-panel");
    const button = document.getElementById("analysis-collapse");
    panel.classList.toggle("collapsed", state.analysisCollapsed);
    document.querySelector(".charts-col")?.classList.toggle(
      "analysis-collapsed", state.analysisCollapsed
    );
    button.textContent = state.analysisCollapsed ? "展开" : "收起";
    button.setAttribute("aria-expanded", String(!state.analysisCollapsed));
    requestAnimationFrame(PanelSlot.resizeVisible);
  }

  async function syncActivePanel() {
    if (!activeControlContext) return;
    const { state } = activeControlContext;
    const visualizationControls = await VisualizationControls.initialize(
      activeControlContext
    );
    AnalysisControls.initialize(activeControlContext);
    RegionControls.initialize(activeControlContext);
    TimelineController.setup(
      state.isSeries ? state.dates : [],
      activeControlContext.onDateChange,
      activeControlContext.onDateChange,
      activeControlContext.preparePlayback
    );
    visualizationControls.applyDimensionMode();
    const total = state.meta.depths.length;
    setText("depth-index", `第 ${state.depthIdx + 1} / ${total} 层`);
    applyAnalysisCollapse(state);
    PiscesUIEvents.panel(state);
    await activeControlContext.renderProfile();
  }

  return { initialize, syncActivePanel };
})();
