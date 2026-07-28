/**
 * Load one analysis session and compose its independent UI controllers.
 */
const WorkspaceController = (() => {
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
    state.points = [];
    state.pointsByMode = { point: [], transect: [] };
    state.depthIdx = 0;
    const savedVariable = sessionStorage.getItem("lastVariable");
    state.variable = (
      savedVariable && defaults[savedVariable] ? savedVariable : "ss"
    );
    state.varType = metadata.vars_2d.includes(state.variable) ? "2d" : "3d";
    state.isVector = (
      metadata.vars_vector.includes(state.variable)
      || state.variable === "mwd"
    );
    state.quiverStep = 20;
    state.depthRange = null;
    state.valueRange = null;
    state.comparisonSource = "a";
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
    });

    renderComparisonFiles(state);
    updateMetadata(metadata);

    const visualizationControls = await VisualizationControls.initialize({
      state,
      apiFetch,
      defaults,
      labels,
      units,
      colorscales,
      renderVolume,
      renderLayer,
      renderProfile,
    });
    AnalysisControls.initialize({
      state,
      onDepthChange,
      renderLayer,
      renderProfile,
    });
    TimelineController.setup(
      state.isSeries ? state.dates : [],
      onDateChange
    );

    await renderLayer(0);
    visualizationControls.applyDimensionMode();
    const empty = emptyFigure("请在上方地图选择一个位置");
    Plotly.newPlot(
      "profile-graph", empty.data, empty.layout, plotConfig
    );
    setProfileTitle(
      state.isComparison
        ? "单点垂直剖面对比 · 当前展示序列 A"
        : "单点垂直剖面"
    );
    MapSelection.initDrag();
  }

  return { initialize };
})();
