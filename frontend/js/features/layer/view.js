/** Horizontal layer-map feature view. */
const LayerView = (() => {
  async function render({
    state, slot, depthIndex, points, fetchJson, plotConfig,
    attachInteractions, renderVersion,
  }) {
    try {
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
      if (state.isSeries) params.set("date_idx", state.dateIdx);
      if (state.isVector) params.set("step", state.quiverStep);

      const requestDepth = state.varType === "2d" ? 0 : depthIndex;
      const result = await fetchJson(`/api/layer/${requestDepth}?${params}`);
      if (
        renderVersion !== state.panelRenderVersions[slot.id]
        || state.drag.active
      ) {
        return false;
      }
      const graph = slot.graph;
      graph.removeAllListeners?.("plotly_relayout");
      let savedRange = null;
      if (graph._fullLayout) {
        const xaxis = graph._fullLayout.xaxis;
        const yaxis = graph._fullLayout.yaxis;
        if (xaxis && yaxis && !xaxis.autorange && !yaxis.autorange) {
          savedRange = {
            "xaxis.range": [...xaxis.range],
            "yaxis.range": [...yaxis.range],
          };
        }
      }
      Plotly.react(
        graph, result.figure.data, result.figure.layout, plotConfig
      );
      if (savedRange) Plotly.relayout(graph, savedRange);
      slot.title.textContent = result.title;
      attachInteractions(graph, slot.id);
      return true;
    } catch (error) {
      throw error;
    }
  }

  return { render };
})();
