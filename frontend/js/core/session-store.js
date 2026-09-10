/** Central UI state with two independently configurable analysis panels. */
const SessionStore = (() => {
  const panelKeys = new Set([
    "depthIdx", "mode", "variable", "varType", "isVector",
    "points", "pointsByMode", "colorRange", "depthRange", "valueRange",
    "varConfig", "quiverStep", "region", "regionSelecting", "drag",
    "dateIdx", "comparisonSource", "playing", "preparingPlayback",
    "playTimer", "visibleLayers", "playInterval",
  ]);

  function createPanel(id) {
    return {
      enabled: true,
      viewType: id === "left" ? "volume3d" : "layer2d",
      depthIdx: 0,
      mode: "point",
      variable: "ss",
      varType: "3d",
      isVector: false,
      points: [],
      pointsByMode: { point: [], transect: [] },
      colorRange: null,
      depthRange: null,
      valueRange: null,
      varConfig: {},
      quiverStep: 20,
      region: null,
      regionSelecting: false,
      drag: { active: false, pointIdx: null, hoverPointIdx: null },
      dateIdx: 0,
      comparisonSource: "a",
      playing: false,
      preparingPlayback: false,
      playTimer: null,
      visibleLayers: null,
      playInterval: 3,
    };
  }

  const base = {
    meta: null,
    dates: [],
    isSeries: false,
    isComparison: false,
    comparisonFiles: [],
    layerRenderVersion: 0,
    panelSlots: {
      left: createPanel("left"),
      right: createPanel("right"),
    },
    activeAnalysisSlot: "right",
    panelRenderVersions: { left: 0, right: 0 },
    analysisCollapsed: false,
    configLoaded: false,
    linked3d2d: false,
    linkedSnapshot: null,
    last3dVariable: "ss",
  };

  const linkedKeys = [
    "variable", "varType", "isVector", "dateIdx", "depthIdx",
    "colorRange", "depthRange", "valueRange", "varConfig",
    "quiverStep", "region", "playInterval",
  ];

  function cloneValue(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }

  function snapshotPanel(panel) {
    const copy = {};
    Object.entries(panel).forEach(([key, value]) => {
      if (key !== "playTimer") copy[key] = cloneValue(value);
    });
    copy.playTimer = null;
    copy.playing = false;
    copy.preparingPlayback = false;
    return copy;
  }

  function syncLinked(sourceSlot, keys = linkedKeys) {
    if (!base.linked3d2d) return;
    const targetSlot = sourceSlot === "left" ? "right" : "left";
    const source = base.panelSlots[sourceSlot];
    const target = base.panelSlots[targetSlot];
    keys.forEach(key => {
      if (key === "varConfig") {
        const visibleLayers = target.varConfig?.visible_layers;
        target.varConfig = cloneValue(source.varConfig);
        if (visibleLayers) target.varConfig.visible_layers = visibleLayers;
        else delete target.varConfig.visible_layers;
        return;
      }
      target[key] = cloneValue(source[key]);
    });
    if (source.varType === "3d") base.last3dVariable = source.variable;
  }

  function beginLinked(sourceSlot = base.activeAnalysisSlot) {
    if (base.linked3d2d) return;
    base.linkedSnapshot = {
      activeAnalysisSlot: base.activeAnalysisSlot,
      panels: {
        left: snapshotPanel(base.panelSlots.left),
        right: snapshotPanel(base.panelSlots.right),
      },
    };
    base.linked3d2d = true;
    base.panelSlots.left.enabled = true;
    base.panelSlots.right.enabled = true;
    syncLinked(sourceSlot);
  }

  function endLinked() {
    const snapshot = base.linkedSnapshot;
    base.linked3d2d = false;
    base.linkedSnapshot = null;
    if (!snapshot?.panels) return;
    ["left", "right"].forEach(slotId => {
      Object.assign(base.panelSlots[slotId], snapshotPanel(snapshot.panels[slotId]));
    });
    base.activeAnalysisSlot = snapshot.activeAnalysisSlot;
  }

  function proxyFor(slotResolver) {
    return new Proxy(base, {
      get(target, property) {
        if (panelKeys.has(property)) {
          return target.panelSlots[slotResolver()][property];
        }
        return target[property];
      },
      set(target, property, value) {
        if (panelKeys.has(property)) {
          target.panelSlots[slotResolver()][property] = value;
        } else {
          target[property] = value;
        }
        return true;
      },
    });
  }

  const state = proxyFor(() => base.activeAnalysisSlot);
  const panelViews = {
    left: proxyFor(() => "left"),
    right: proxyFor(() => "right"),
  };

  function forPanel(slotId) {
    return panelViews[slotId];
  }

  function activate(slotId) {
    if (base.panelSlots[slotId]?.enabled) base.activeAnalysisSlot = slotId;
    return state;
  }

  function remember3dVariable(variable) {
    if (variable) base.last3dVariable = variable;
  }

  function resetPanelSession(panel) {
    panel.depthIdx = 0;
    panel.points = [];
    panel.pointsByMode = { point: [], transect: [] };
    panel.dateIdx = 0;
    panel.regionSelecting = false;
    panel.drag = { active: false, pointIdx: null, hoverPointIdx: null };
    panel.playing = false;
    panel.preparingPlayback = false;
    panel.playTimer = null;
  }

  function resetDataSession() {
    Object.values(base.panelSlots).forEach(resetPanelSession);
    base.meta = null;
    base.dates = [];
    base.isSeries = false;
    base.isComparison = false;
    base.comparisonFiles = [];
    base.layerRenderVersion += 1;
    base.panelRenderVersions = { left: 0, right: 0 };
    base.linked3d2d = false;
    base.linkedSnapshot = null;
  }

  function validRegion(region, meta) {
    if (!Array.isArray(region) || region.length !== 4) return null;
    const values = region.map(Number);
    const [lonMin, lonMax, latMin, latMax] = values;
    if (
      values.some(value => !Number.isFinite(value))
      || lonMin >= lonMax || latMin >= latMax
      || lonMin < meta.lon_range[0] || lonMax > meta.lon_range[1]
      || latMin < meta.lat_range[0] || latMax > meta.lat_range[1]
    ) return null;
    return values;
  }

  function nearestDepthIndex(depths, savedDepth) {
    if (!Number.isFinite(Number(savedDepth))) return 0;
    return depths.reduce((best, depth, index) => (
      Math.abs(depth - savedDepth) < Math.abs(depths[best] - savedDepth)
        ? index : best
    ), 0);
  }

  function applyConfiguration(saved, defaults, meta) {
    const workspace = saved.workspace || {};
    const savedPanels = workspace.panels || {};
    ["left", "right"].forEach(slotId => {
      const panel = base.panelSlots[slotId];
      const panelSaved = savedPanels[slotId] || {};
      const variableSaved = panelSaved.variables || {};
      panel.varConfig = {};
      Object.keys(defaults).forEach(variable => {
        panel.varConfig[variable] = {
          ...defaults[variable],
          ...(saved[variable] || {}),
          ...(variableSaved[variable] || {}),
        };
      });
      const visible = panelSaved.visible_layers ?? saved.visible_layers;
      if (Array.isArray(visible)) panel.varConfig.visible_layers = visible;
      panel.visibleLayers = Array.isArray(visible)
        ? meta.depths.map((_, index) => visible.includes(index))
        : meta.depths.map((_, index) => index % 2 === 0);
      panel.region = validRegion(panelSaved.region ?? saved.region, meta);
      panel.varConfig.region = panel.region;
      panel.enabled = panelSaved.enabled !== false;
      panel.viewType = panelSaved.view_type || (
        base.isComparison
          ? (slotId === "left" ? "comparisonA" : "comparisonB")
          : panel.viewType
      );
      panel.variable = defaults[panelSaved.variable]
        ? panelSaved.variable : panel.variable;
      panel.mode = ["point", "transect"].includes(panelSaved.mode)
        ? panelSaved.mode : "point";
      const currentConfig = panel.varConfig[panel.variable];
      panel.colorRange = [currentConfig.min, currentConfig.max];
      panel.depthRange = (
        currentConfig.depth_min != null && currentConfig.depth_max != null
          ? [currentConfig.depth_min, currentConfig.depth_max] : null
      );
      panel.valueRange = (
        currentConfig.value_min != null && currentConfig.value_max != null
          ? [currentConfig.value_min, currentConfig.value_max] : null
      );
      panel.varType = meta.vars_2d.includes(panel.variable) ? "2d" : "3d";
      panel.isVector = (
        meta.vars_vector.includes(panel.variable) || panel.variable === "mwd"
      );
      panel.depthIdx = nearestDepthIndex(meta.depths, panelSaved.depth_m);
      const savedDateIndex = base.dates.indexOf(panelSaved.date);
      panel.dateIdx = savedDateIndex >= 0 ? savedDateIndex : 0;
      panel.quiverStep = Math.max(
        1, Math.min(40, Number(panelSaved.quiver_step) || 20)
      );
      panel.playInterval = Math.max(
        1, Math.min(60, Number(panelSaved.play_interval) || 3)
      );
    });
    if (!Object.values(base.panelSlots).some(panel => panel.enabled)) {
      base.panelSlots.left.enabled = true;
    }
    base.analysisCollapsed = workspace.analysis_collapsed === true;
    base.linked3d2d = workspace.linked_3d2d === true;
    base.linkedSnapshot = workspace.linked_snapshot || null;
    base.last3dVariable = defaults[workspace.last_3d_variable]
      ? workspace.last_3d_variable : "ss";
    if (["left", "right"].includes(workspace.active_panel)) {
      base.activeAnalysisSlot = workspace.active_panel;
    }
    if (!base.panelSlots[base.activeAnalysisSlot].enabled) {
      base.activeAnalysisSlot = base.panelSlots.right.enabled ? "right" : "left";
    }
    base.configLoaded = true;
  }

  function serializeConfiguration() {
    const left = base.panelSlots.left;
    const result = {};
    Object.entries(left.varConfig).forEach(([key, value]) => {
      if (value && typeof value === "object" && !Array.isArray(value)) {
        result[key] = value;
      }
    });
    result.visible_layers = left.varConfig.visible_layers || [];
    result.region = left.region;
    result.workspace = {
      version: 1,
      analysis_collapsed: base.analysisCollapsed,
      active_panel: base.activeAnalysisSlot,
      panels: {},
      linked_3d2d: base.linked3d2d,
      linked_snapshot: cloneValue(base.linkedSnapshot),
      last_3d_variable: base.last3dVariable,
    };
    ["left", "right"].forEach(slotId => {
      const panel = base.panelSlots[slotId];
      const variables = {};
      Object.entries(panel.varConfig).forEach(([key, value]) => {
        if (value && typeof value === "object" && !Array.isArray(value)) {
          variables[key] = value;
        }
      });
      result.workspace.panels[slotId] = {
        enabled: panel.enabled,
        view_type: panel.viewType,
        variable: panel.variable,
        mode: panel.mode,
        date: base.dates[panel.dateIdx] ?? null,
        depth_m: base.meta?.depths?.[panel.depthIdx] ?? null,
        quiver_step: panel.quiverStep,
        play_interval: panel.playInterval,
        visible_layers: panel.varConfig.visible_layers || [],
        region: panel.region,
        variables,
      };
    });
    return result;
  }

  return {
    state,
    forPanel,
    activate,
    remember3dVariable,
    resetDataSession,
    applyConfiguration,
    serializeConfiguration,
    beginLinked,
    endLinked,
    syncLinked,
  };
})();
