/** Two-point vertical transect feature. */
const TransectView = (() => {
  function request(state, dateIndex = state.dateIdx) {
    const [point1, point2] = state.points;
    return {
      url: "/api/transect",
      options: {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
        p1: { lat: point1.lat, lon: point1.lon },
        p2: { lat: point2.lat, lon: point2.lon },
        depth_idx: state.depthIdx,
        variable: state.variable,
        depth_range: state.depthRange,
        value_range: state.valueRange,
        date_idx: dateIndex,
        comparison_source: state.comparisonSource,
        region: state.region,
        }),
      },
    };
  }

  async function render({ state, fetchJson, plotConfig, setTitle, setInfo }) {
    const preparedRequest = request(state);
    const result = await fetchJson(
      preparedRequest.url,
      preparedRequest.options,
    );
    await Plotly.react(
      "profile-graph", result.figure.data, result.figure.layout, plotConfig
    );
    setTitle(
      state.isComparison ? result.title.split(" · ").at(-1) : result.title
    );
    setInfo(result.info);
  }

  return { render, request };
})();
