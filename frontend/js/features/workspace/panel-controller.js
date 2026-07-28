/** Coordinates the two reusable visualization slots. */
const PanelController = (() => {
  let options = null;
  let renderRun = 0;

  function definition(state, slotId) {
    return PanelRegistry.definitions[state.panelSlots[slotId].viewType];
  }

  function populateSelector(state, slot) {
    const selected = state.panelSlots[slot.id].viewType;
    slot.select.innerHTML = "";
    PanelRegistry.available(state).forEach(([key, item]) => {
      const option = document.createElement("option");
      option.value = key;
      option.textContent = item.label;
      slot.select.appendChild(option);
    });
    slot.select.value = selected;
  }

  function updateActiveState(state) {
    const selectableSlots = ["left", "right"].filter(slotId => (
      definition(state, slotId)?.selectable
    ));
    if (!selectableSlots.includes(state.activeAnalysisSlot)) {
      state.activeAnalysisSlot = selectableSlots[0] || null;
    }
    ["left", "right"].forEach(slotId => {
      PanelSlot.setActive(
        PanelSlot.get(slotId),
        slotId === state.activeAnalysisSlot
      );
    });
    const empty = document.getElementById("analysis-unavailable");
    empty.classList.toggle("hidden", selectableSlots.length > 0);
  }

  function activate(slotId) {
    const { state } = options;
    if (!definition(state, slotId)?.selectable) return;
    state.activeAnalysisSlot = slotId;
    updateActiveState(state);
  }

  function refreshSelectors() {
    const { state } = options;
    PanelRegistry.reconcile(state);
    ["left", "right"].forEach(slotId => {
      const slot = PanelSlot.get(slotId);
      populateSelector(state, slot);
      const item = definition(state, slotId);
      slot.title.textContent = item?.label || "不可用视图";
      slot.source.textContent = state.isComparison
        ? "选择 A、B 或差值进行比较"
        : "数据来源：当前数据";
    });
    updateActiveState(state);
  }

  async function renderNormalSlot(slotId, run) {
    const { state } = options;
    const slot = PanelSlot.get(slotId);
    const item = definition(state, slotId);
    const version = ++state.panelRenderVersions[slotId];
    PanelSlot.setError(slot);
    if (!state.playing) PanelSlot.setLoading(slot, true);
    slot.graph.dataset.viewKind = item?.selectable ? "map" : "volume";
    slot.graph.dataset.selectable = item?.selectable ? "true" : "false";
    slot.source.textContent = "数据来源：当前数据";
    try {
      if (item.requires3d && state.varType !== "3d") {
        throw new Error(item.emptyMessage);
      }
      if (item === PanelRegistry.definitions.volume3d) {
        return await VolumeView.render({
          state,
          slot,
          fetchJson: options.fetchJson,
          plotConfig: options.plotConfig,
          onDepthChange: options.onDepthChange,
          renderVersion: version,
        });
      }
      return await LayerView.render({
        state,
        slot,
        depthIndex: state.depthIdx,
        points: state.points,
        fetchJson: options.fetchJson,
        plotConfig: options.mapPlotConfig,
        attachInteractions: MapSelection.attach,
        renderVersion: version,
      });
    } catch (error) {
      if (run === renderRun && !options.handleExpiredData(error)) {
        PanelSlot.setError(slot, error.detail || error.message || "请求失败");
      }
      return false;
    } finally {
      if (version === state.panelRenderVersions[slotId]) {
        PanelSlot.setLoading(slot, false);
      }
    }
  }

  async function renderComparisonSlots(run) {
    const { state } = options;
    const slots = ["left", "right"].map(PanelSlot.get);
    const layerSlots = slots.filter(slot => !definition(state, slot.id).volume);
    const volumeSlots = slots.filter(slot => definition(state, slot.id).volume);
    slots.forEach(slot => {
      ++state.panelRenderVersions[slot.id];
      PanelSlot.setError(slot);
      if (!state.playing) PanelSlot.setLoading(slot, true);
      slot.graph.dataset.selectable = definition(state, slot.id).selectable
        ? "true" : "false";
    });
    const config = state.varConfig[state.variable] || {};

    async function renderLayers() {
      if (!layerSlots.length) return true;
      try {
        const data = await ComparisonView.load({
          depthIdx: state.depthIdx,
          variable: state.variable,
          dateIdx: state.dateIdx,
          is2d: state.varType === "2d",
          colorRange: state.colorRange,
          colorscale: config.colorscale,
          quiverStep: state.isVector ? state.quiverStep : null,
          points: state.points,
          fetchJson: options.fetchJson,
        });
        if (run !== renderRun || state.drag.active || !data) return false;
        await Promise.all(layerSlots.map(slot => {
          const item = definition(state, slot.id);
          return ComparisonView.render({
            state,
            slot,
            data,
            source: item.source,
            plotConfig: options.mapPlotConfig,
            attachInteractions: MapSelection.attach,
          });
        }));
        return true;
      } catch (error) {
        if (!options.handleExpiredData(error)) {
          layerSlots.forEach(slot => {
            PanelSlot.setError(
              slot, error.detail || error.message || "二维切层请求失败"
            );
          });
        }
        return false;
      }
    }

    async function renderVolumeSlot(slot) {
      const item = definition(state, slot.id);
      const version = state.panelRenderVersions[slot.id];
      try {
        return await VolumeView.renderComparison({
          state,
          slot,
          source: item.source,
          fetchJson: options.fetchJson,
          plotConfig: options.plotConfig,
          onDepthChange: options.onDepthChange,
          renderVersion: version,
        });
      } catch (error) {
        if (!options.handleExpiredData(error)) {
          PanelSlot.setError(
            slot, error.detail || error.message || "三维场请求失败"
          );
        }
        return false;
      }
    }

    try {
      await Promise.all([
        renderLayers(),
        ...volumeSlots.map(renderVolumeSlot),
      ]);
      return run === renderRun;
    } finally {
      if (run === renderRun) {
        slots.forEach(slot => PanelSlot.setLoading(slot, false));
      }
    }
  }

  async function renderAll() {
    if (!options?.state.meta) return false;
    const run = ++renderRun;
    if (options.state.isComparison) return renderComparisonSlots(run);
    return Promise.all([
      renderNormalSlot("left", run),
      renderNormalSlot("right", run),
    ]);
  }

  function initialize(config) {
    options = config;
    PanelRegistry.initializeSlots(config.state);
    ["left", "right"].forEach(slotId => {
      const slot = PanelSlot.get(slotId);
      populateSelector(config.state, slot);
      slot.select.onchange = async () => {
        config.state.panelSlots[slotId].viewType = slot.select.value;
        updateActiveState(config.state);
        await renderAll();
        await config.renderProfile();
      };
      slot.root.onmousedown = () => activate(slotId);
    });
    refreshSelectors();
  }

  function invalidate() {
    renderRun += 1;
    if (options) {
      options.state.panelRenderVersions.left += 1;
      options.state.panelRenderVersions.right += 1;
    }
  }

  return {
    initialize, renderAll, refreshSelectors, activate, invalidate,
  };
})();
