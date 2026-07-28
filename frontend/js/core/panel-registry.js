/** Metadata and defaults for the two visualization slots. */
const PanelRegistry = (() => {
  const definitions = {
    volume3d: {
      label: "三维场",
      modes: ["single", "series"],
      requires3d: true,
      selectable: false,
      emptyMessage: "当前变量不支持三维显示",
    },
    layer2d: {
      label: "水平切层",
      modes: ["single", "series"],
      requires3d: false,
      selectable: true,
    },
    comparisonA: {
      label: "水平切层 · 序列 A",
      modes: ["comparison"],
      requires3d: false,
      selectable: true,
      source: "a",
    },
    comparisonB: {
      label: "水平切层 · 序列 B",
      modes: ["comparison"],
      requires3d: false,
      selectable: true,
      source: "b",
    },
    comparisonDifference: {
      label: "水平切层 · 差值 A−B",
      modes: ["comparison"],
      requires3d: false,
      selectable: true,
      source: "difference",
    },
    comparisonVolumeA: {
      label: "三维场 · 序列 A",
      modes: ["comparison"],
      requires3d: true,
      selectable: false,
      source: "a",
      volume: true,
    },
    comparisonVolumeB: {
      label: "三维场 · 序列 B",
      modes: ["comparison"],
      requires3d: true,
      selectable: false,
      source: "b",
      volume: true,
    },
    comparisonVolumeDifference: {
      label: "三维场 · 差值 A−B",
      modes: ["comparison"],
      requires3d: true,
      selectable: false,
      source: "difference",
      volume: true,
    },
  };

  function mode(state) {
    if (state.isComparison) return "comparison";
    return state.isSeries ? "series" : "single";
  }

  function available(state) {
    const currentMode = mode(state);
    return Object.entries(definitions).filter(([, definition]) => (
      definition.modes.includes(currentMode)
      && (!definition.requires3d || state.varType === "3d")
    ));
  }

  function initializeSlots(state) {
    state.panelSlots = state.isComparison
      ? {
        left: { viewType: "comparisonA" },
        right: { viewType: "comparisonB" },
      }
      : {
        left: { viewType: state.varType === "3d" ? "volume3d" : "layer2d" },
        right: { viewType: "layer2d" },
      };
    state.activeAnalysisSlot = state.isComparison ? "left" : "right";
    state.panelRenderVersions = { left: 0, right: 0 };
  }

  function reconcile(state) {
    const allowed = new Set(available(state).map(([key]) => key));
    const fallback = available(state)[0]?.[0] || null;
    ["left", "right"].forEach(slotId => {
      if (!allowed.has(state.panelSlots[slotId].viewType)) {
        state.panelSlots[slotId].viewType = fallback;
      }
    });
  }

  return { definitions, mode, available, initializeSlots, reconcile };
})();
