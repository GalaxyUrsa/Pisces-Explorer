/** Two-point vertical transect feature. */
const TransectView = (() => {
  async function render({ state, fetchJson, plotConfig, setTitle, setInfo }) {
    const [point1, point2] = state.points;
    const result = await fetchJson("/api/transect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        p1: { lat: point1.lat, lon: point1.lon },
        p2: { lat: point2.lat, lon: point2.lon },
        depth_idx: state.depthIdx,
        variable: state.variable,
        depth_range: state.depthRange,
        value_range: state.valueRange,
        date_idx: state.dateIdx,
        comparison_source: state.comparisonSource,
      }),
    });
    Plotly.react(
      "profile-graph", result.figure.data, result.figure.layout, plotConfig
    );
    setTitle(result.title);
    setInfo(result.info);
  }

  return { render };
})();
