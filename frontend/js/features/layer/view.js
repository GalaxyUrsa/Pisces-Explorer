/** Horizontal layer-map feature view. */
const LayerView = (() => {
  function updateQuiverInfo(metadata) {
    const info = document.getElementById("quiver-effective-info");
    if (!info) return;
    if (!metadata) {
      info.textContent = "";
      return;
    }
    info.textContent =
      `自动步长 ${metadata.effective_step} · `
      + `${metadata.arrow_count.toLocaleString()} 支箭头`
      + `（上限 ${metadata.max_arrows.toLocaleString()}）`;
  }

  function requestUrl(
    state,
    depthIndex,
    points,
    dateIndex = state.dateIdx,
  ) {
    const config = state.varConfig[state.variable] || {};
    const params = new URLSearchParams({ variable: state.variable });
    if (points.length) params.set("points", JSON.stringify(points));
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
    if (state.isSeries) params.set("date_idx", dateIndex);
    if (state.isVector) params.set("step", state.quiverStep);
    RegionControls.appendQuery(params, state.region);
    const requestDepth = state.varType === "2d" ? 0 : depthIndex;
    return `/api/layer/${requestDepth}?${params}`;
  }

  async function render({
    state, slot, depthIndex, points, fetchJson, plotConfig,
    attachInteractions, renderVersion,
  }) {
    try {
      const result = await fetchJson(
        requestUrl(state, depthIndex, points)
      );
      if (
        renderVersion !== state.panelRenderVersions[slot.id]
        || state.drag.active
      ) {
        return false;
      }
      const graph = slot.graph;
      graph.removeAllListeners?.("plotly_relayout");
      let savedRange = null;
      const regionKey = JSON.stringify(state.region);
      if (graph._fullLayout && graph.dataset.regionKey === regionKey) {
        const xaxis = graph._fullLayout.xaxis;
        const yaxis = graph._fullLayout.yaxis;
        if (xaxis && yaxis && !xaxis.autorange && !yaxis.autorange) {
          savedRange = {
            "xaxis.range": [...xaxis.range],
            "yaxis.range": [...yaxis.range],
          };
        }
      }
      await Plotly.react(
        graph, result.figure.data, result.figure.layout, plotConfig
      );
      graph.dataset.regionKey = regionKey;
      if (savedRange) await Plotly.relayout(graph, savedRange);
      slot.title.textContent = result.title;
      updateQuiverInfo(result.quiver);
      attachInteractions(graph, slot.id);
      return true;
    } catch (error) {
      throw error;
    }
  }

  return { render, requestUrl, updateQuiverInfo };
})();
