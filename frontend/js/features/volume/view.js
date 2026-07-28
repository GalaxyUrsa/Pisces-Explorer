/** 3D volume feature view. */
const VolumeView = (() => {
  function selectedLayers(state) {
    return state.visibleLayers
      ? state.visibleLayers
        .map((visible, index) => visible ? index : -1)
        .filter(index => index >= 0)
      : Array.from(
        { length: state.meta.depths.length },
        (_, index) => index
      );
  }

  function attachDepthSelection(state, graph, onDepthChange) {
    const layers = selectedLayers(state);
    graph.removeAllListeners?.("plotly_click");
    graph.removeAllListeners?.("plotly_hover");
    graph.removeAllListeners?.("plotly_unhover");
    graph.removeAllListeners?.("plotly_relayout");
    graph.on("plotly_click", event => {
      const curveNumber = event?.points?.[0]?.curveNumber;
      const depthIndex = layers[curveNumber];
      if (
        depthIndex == null ||
        depthIndex < 0 ||
        depthIndex >= state.meta.depths.length
      ) return;
      document.getElementById("depth-select").value = depthIndex;
      document.getElementById("depth-slider").value = depthIndex;
      onDepthChange(depthIndex);
    });
  }

  function appendDisplayParams(state, params) {
    const config = state.varConfig[state.variable] || {};
    if (state.colorRange) {
      params.set("cmin", state.colorRange[0]);
      params.set("cmax", state.colorRange[1]);
    }
    if (config.color_min && config.color_max) {
      params.set("color_min", config.color_min);
      params.set("color_max", config.color_max);
    } else if (config.colorscale) {
      params.set("colorscale", config.colorscale);
    }
    if (state.visibleLayers) {
      const layers = selectedLayers(state);
      if (layers.length) params.set("layers", layers.join(","));
    }
  }

  async function render({
    state, slot, fetchJson, plotConfig, onDepthChange, renderVersion,
  }) {
    if (state.varType === "2d" || state.isComparison) return false;
    try {
      const params = new URLSearchParams({ variable: state.variable });
      appendDisplayParams(state, params);
      if (state.isSeries) params.set("date_idx", state.dateIdx);

      const figure = await fetchJson(`/api/volume?${params}`);
      if (renderVersion !== state.panelRenderVersions[slot.id]) return false;
      await Plotly.react(slot.graph, figure.data, figure.layout, plotConfig);

      const graph = slot.graph;
      attachDepthSelection(state, graph, onDepthChange);
      return true;
    } catch (error) {
      throw error;
    }
  }

  async function renderComparison({
    state, slot, source, fetchJson, plotConfig,
    onDepthChange, renderVersion,
  }) {
    const params = new URLSearchParams({
      variable: state.variable,
      comparison_source: source,
      date_idx: state.dateIdx,
    });
    appendDisplayParams(state, params);
    const result = await fetchJson(`/api/comparison/volume?${params}`);
    if (renderVersion !== state.panelRenderVersions[slot.id]) return false;
    await Plotly.react(
      slot.graph,
      result.figure.data,
      result.figure.layout,
      plotConfig
    );
    slot.title.textContent = result.title;
    slot.source.textContent = source === "difference"
      ? "数据来源：序列 A−序列 B"
      : `数据来源：序列 ${source.toUpperCase()}`;
    slot.graph.dataset.viewKind = "volume";
    slot.graph.dataset.selectable = "false";
    attachDepthSelection(state, slot.graph, onDepthChange);
    return true;
  }

  return { render, renderComparison };
})();
