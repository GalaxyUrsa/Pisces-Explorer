/** Central mutable UI session state. */
const SessionStore = (() => {
  const state = {
    depthIdx: 0,
    mode: "point",
    variable: "ss",
    varType: "3d",
    isVector: false,
    points: [],
    pointsByMode: {
      point: [],
      transect: [],
    },
    meta: null,
    colorRange: null,
    depthRange: null,
    valueRange: null,
    varConfig: {},
    quiverStep: 20,
    drag: {
      active: false,
      pointIdx: null,
      hoverPointIdx: null,
    },
    dateIdx: 0,
    dates: [],
    isSeries: false,
    isComparison: false,
    comparisonFiles: [],
    comparisonSource: "a",
    playing: false,
    playTimer: null,
    layerRenderVersion: 0,
    panelSlots: {
      left: { viewType: "volume3d" },
      right: { viewType: "layer2d" },
    },
    activeAnalysisSlot: "right",
    panelRenderVersions: { left: 0, right: 0 },
  };

  function resetDataSession() {
    state.depthIdx = 0;
    state.points = [];
    state.pointsByMode = { point: [], transect: [] };
    state.meta = null;
    state.dateIdx = 0;
    state.dates = [];
    state.isSeries = false;
    state.isComparison = false;
    state.comparisonFiles = [];
    state.comparisonSource = "a";
    state.playing = false;
    state.playTimer = null;
    state.layerRenderVersion += 1;
    state.panelRenderVersions = { left: 0, right: 0 };
  }

  return { state, resetDataSession };
})();
