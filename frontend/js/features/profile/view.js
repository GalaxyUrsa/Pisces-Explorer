/** Single-point vertical profile feature. */
const ProfileView = (() => {
  async function render({ state, fetchJson, plotConfig, setTitle, setInfo }) {
    const point = state.points[state.points.length - 1];
    const result = await fetchJson("/api/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lat: point.lat,
        lon: point.lon,
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
