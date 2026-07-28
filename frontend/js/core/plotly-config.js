/** Plotly interaction presets shared by feature views. */
const PlotlyConfig = (() => {
  const commonButtons = [
    "zoom2d", "pan2d", "select2d", "lasso2d",
    "zoomIn2d", "zoomOut2d", "autoScale2d", "resetScale2d",
    "hoverClosestCartesian", "hoverCompareCartesian",
    "toggleHover", "toggleSpikelines", "resetViews",
  ];
  const chart = {
    scrollZoom: true,
    displayModeBar: true,
    doubleClick: "reset",
    displaylogo: false,
    modeBarButtonsToRemove: [
      ...commonButtons,
      "zoom3d", "pan3d", "orbitRotation", "tableRotation",
      "resetCameraDefault3d", "resetCameraLastSave3d",
      "hoverClosest3d", "hoverClosestGl2d", "hoverClosestPie",
    ],
  };
  const map = {
    scrollZoom: true,
    displayModeBar: true,
    doubleClick: "reset",
    displaylogo: false,
    plotGlPixelRatio: 1,
    modeBarButtonsToRemove: [...commonButtons, "hoverClosestGl2d"],
  };
  return { chart, map };
})();
