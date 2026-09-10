/** Metadata and defaults for the two visualization slots. */
const PanelRegistry = (() => {
  const definitions = {
    volume3d: {
      label: "三维场",
      modes: ["single", "series"],
      requires3d: true,
      selectable: false,
      volume: true,
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

  function available(state, slotId = null) {
    const currentMode = mode(state);
    return Object.entries(definitions).filter(([, definition]) => (
      definition.modes.includes(currentMode)
      && (!definition.requires3d || state.varType === "3d")
      && (!state.linked3d2d || !slotId
        || (slotId === "left" ? definition.volume : !definition.volume))
    ));
  }

  function initializeSlots(state) {
    if (state.isComparison && !state.linked3d2d) {
      state.panelSlots.left.viewType = "comparisonA";
      state.panelSlots.right.viewType = "comparisonB";
      state.activeAnalysisSlot = state.panelSlots.left.enabled ? "left" : "right";
    }
    state.panelRenderVersions = { left: 0, right: 0 };
  }

  function reconcile(state) {
    ["left", "right"].forEach(slotId => {
      const panelState = SessionStore.forPanel(slotId);
      const choices = available(panelState, slotId);
      const allowed = new Set(choices.map(([key]) => key));
      const fallback = choices[0]?.[0] || null;
      if (!allowed.has(state.panelSlots[slotId].viewType)) {
        state.panelSlots[slotId].viewType = fallback;
      }
      if (
        definitions[state.panelSlots[slotId].viewType]?.requires3d
        && panelState.varType !== "3d"
      ) state.panelSlots[slotId].viewType = fallback;
    });
  }

  return { definitions, mode, available, initializeSlots, reconcile };
})();
