/** Single-point vertical profile feature. */
const ProfileView = (() => {
  function request(state, dateIndex = state.dateIdx) {
    const point = state.points[state.points.length - 1];
    return {
      url: "/api/profile",
      options: {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
        lat: point.lat,
        lon: point.lon,
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
