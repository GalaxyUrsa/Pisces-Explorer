/** 3D volume feature view. */
const VolumeView = (() => {
  function signature(url) {
    const parsed = new URL(url, window.location.origin);
    parsed.searchParams.delete("date_idx");
    return `${parsed.pathname}?${parsed.searchParams.toString()}`;
  }

  async function draw(graph, figure, plotConfig, requestSignature, slotId) {
    const reusable = (
      graph.dataset.volumeSignature === requestSignature
      && graph.data?.length === figure.data.length
      && figure.data.every((trace, index) => (
        trace.type === "surface" && graph.data[index]?.type === "surface"
      ))
    );
    if (reusable) {
      for (let index = 0; index < figure.data.length; index += 1) {
        const trace = figure.data[index];
        await Plotly.restyle(graph, {
          z: [trace.z],
          surfacecolor: [trace.surfacecolor],
          cmin: trace.cmin,
          cmax: trace.cmax,
          colorscale: [trace.colorscale],
          hovertemplate: trace.hovertemplate,
        }, [index]);
      }
      return;
    }
    const camera = graph._fullLayout?.scene?.camera;
    if (graph.data || graph._fullLayout) Plotly.purge(graph);
    figure.layout.uirevision = `volume-${slotId}`;
    if (camera && figure.layout.scene) figure.layout.scene.camera = camera;
    await Plotly.react(graph, figure.data, figure.layout, plotConfig);
    graph.dataset.volumeSignature = requestSignature;
  }

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
    RegionControls.appendQuery(params, state.region);
  }

  function requestUrl(
    state,
    dateIndex = state.dateIdx,
    quality = state.playing ? "preview" : "full",
  ) {
    const params = new URLSearchParams({ variable: state.variable });
    appendDisplayParams(state, params);
    if (state.isSeries) params.set("date_idx", dateIndex);
    params.set("quality", quality);
    return `/api/volume?${params}`;
  }

  function comparisonRequestUrl(
    state,
    source,
    dateIndex = state.dateIdx,
    quality = state.playing ? "preview" : "full",
  ) {
    const params = new URLSearchParams({
      variable: state.variable,
      comparison_source: source,
      date_idx: dateIndex,
    });
    appendDisplayParams(state, params);
    params.set("quality", quality);
    return `/api/comparison/volume?${params}`;
  }

  async function render({
    state, slot, fetchJson, plotConfig, onDepthChange, renderVersion,
  }) {
    if (state.varType === "2d" || state.isComparison) return false;
    try {
      const url = requestUrl(state);
      const figure = await fetchJson(url);
      if (renderVersion !== state.panelRenderVersions[slot.id]) return false;
      await draw(slot.graph, figure, plotConfig, signature(url), slot.id);

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
    const url = comparisonRequestUrl(state, source);
    const result = await fetchJson(url);
    if (renderVersion !== state.panelRenderVersions[slot.id]) return false;
    await draw(
      slot.graph, result.figure, plotConfig, signature(url), slot.id
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

  return {
    render,
    renderComparison,
    requestUrl,
    comparisonRequestUrl,
  };
})();
