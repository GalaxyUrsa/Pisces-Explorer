/** Coordinates two independently configured, optional visualization slots. */
const PanelController = (() => {
  let options = null;
  let renderRun = 0;

  function panelState(slotId) {
    return SessionStore.forPanel(slotId);
  }

  function definition(state, slotId) {
    return PanelRegistry.definitions[state.panelSlots[slotId].viewType];
  }

  function populateSelector(state, slot) {
    const scoped = panelState(slot.id);
    const selected = state.panelSlots[slot.id].viewType;
    slot.select.innerHTML = "";
    PanelRegistry.available(scoped, slot.id).forEach(([key, item]) => {
      const option = document.createElement("option");
      option.value = key;
      option.textContent = item.label;
      slot.select.appendChild(option);
    });
    slot.select.value = selected;
  }

  function enabledSlots(state) {
    return ["left", "right"].filter(id => state.panelSlots[id].enabled);
  }

  function syncAnalysisSource(state) {
    const slotId = state.activeAnalysisSlot;
    const source = definition(state, slotId)?.source;
    state.panelSlots[slotId].comparisonSource = (
      state.isComparison && ["a", "b", "difference"].includes(source)
        ? source
        : "a"
    );
  }

  function applyLayout(state) {
    const enabled = enabledSlots(state);
    ["left", "right"].forEach(slotId => {
      const slot = PanelSlot.get(slotId);
      const visible = state.panelSlots[slotId].enabled;
      slot.root.classList.toggle("panel-disabled", !visible);
      if (slot.close) {
        slot.close.disabled = enabled.length <= 1 || state.linked3d2d;
        slot.close.title = state.linked3d2d
          ? "请先退出 3D/2D 联动" : "关闭窗口";
      }
      if (slot.openOther) {
        const other = slotId === "left" ? "right" : "left";
        slot.openOther.classList.toggle(
          "hidden", !visible || state.panelSlots[other].enabled
        );
        slot.openOther.textContent = `打开${other === "left" ? "左" : "右"}窗口`;
      }
    });
    document.getElementById("column-resizer")?.classList.toggle(
      "hidden", enabled.length < 2
    );
    document.getElementById("top-panels")?.classList.toggle(
      "single-panel", enabled.length === 1
    );
    requestAnimationFrame(PanelSlot.resizeVisible);
  }

  function updateActiveState(state) {
    const enabled = enabledSlots(state);
    if (!enabled.includes(state.activeAnalysisSlot)) {
      state.activeAnalysisSlot = enabled[0];
    }
    syncAnalysisSource(state);
    ["left", "right"].forEach(slotId => {
      PanelSlot.setActive(
        PanelSlot.get(slotId),
        state.panelSlots[slotId].enabled
          && slotId === state.activeAnalysisSlot
      );
    });
    const activeDefinition = definition(state, state.activeAnalysisSlot);
    const empty = document.getElementById("analysis-unavailable");
    empty.classList.toggle("hidden", Boolean(activeDefinition?.selectable));
    applyLayout(state);
    PiscesUIEvents.panel(state);
  }

  async function activate(slotId) {
    const state = options.state;
    if (!state.panelSlots[slotId]?.enabled) return;
    const changed = slotId !== state.activeAnalysisSlot;
    if (changed) {
      await TimelineController.stop({ waitForActive: true });
      SessionStore.activate(slotId);
      await RangeControls.save(options.fetchJson);
    }
    updateActiveState(state);
    if (changed) await options.onActivate?.(slotId);
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

  function purgeSlot(slotId) {
    const graph = PanelSlot.get(slotId).graph;
    if (graph.data || graph._fullLayout) Plotly.purge(graph);
    delete graph.dataset.volumeSignature;
    graph.replaceChildren();
  }

  async function renderNormalSlot(slotId, run) {
    const state = panelState(slotId);
    const slot = PanelSlot.get(slotId);
    const item = definition(state, slotId);
    if (item !== PanelRegistry.definitions.volume3d
        && slot.graph.dataset.volumeSignature) purgeSlot(slotId);
    const version = ++state.panelRenderVersions[slotId];
    PanelSlot.setError(slot);
    if (!state.playing) PanelSlot.setLoading(slot, true);
    slot.graph.dataset.viewKind = item?.selectable ? "map" : "volume";
    slot.graph.dataset.selectable = item?.selectable ? "true" : "false";
    slot.source.textContent = "数据来源：当前数据";
    try {
      if (item?.requires3d && state.varType !== "3d") {
        throw new Error(item.emptyMessage);
      }
      if (item === PanelRegistry.definitions.volume3d) {
        return await VolumeView.render({
          state,
          slot,
          fetchJson: options.fetchJson,
          plotConfig: options.plotConfig,
          onDepthChange: index => options.onDepthChange(index, slotId),
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
      if (!options.handleExpiredData(error)) {
        PanelSlot.setError(slot, error.detail || error.message || "请求失败");
      }
      return false;
    } finally {
      if (version === state.panelRenderVersions[slotId]) {
        PanelSlot.setLoading(slot, false);
      }
    }
  }

  async function renderComparisonSlot(slotId, run) {
    const state = panelState(slotId);
    const slot = PanelSlot.get(slotId);
    const item = definition(state, slotId);
    if (!item?.volume && slot.graph.dataset.volumeSignature) purgeSlot(slotId);
    const version = ++state.panelRenderVersions[slotId];
    PanelSlot.setError(slot);
    if (!state.playing) PanelSlot.setLoading(slot, true);
    slot.graph.dataset.selectable = item?.selectable ? "true" : "false";
    try {
      if (item.volume) {
        return await VolumeView.renderComparison({
          state,
          slot,
          source: item.source,
          fetchJson: options.fetchJson,
          plotConfig: options.plotConfig,
          onDepthChange: index => options.onDepthChange(index, slotId),
          renderVersion: version,
        });
      }
      const config = state.varConfig[state.variable] || {};
      const data = await ComparisonView.load({
        depthIdx: state.depthIdx,
        variable: state.variable,
        dateIdx: state.dateIdx,
        is2d: state.varType === "2d",
        colorRange: state.colorRange,
        colorscale: config.colorscale,
        quiverStep: state.isVector ? state.quiverStep : null,
        region: state.region,
        points: state.points,
        fetchJson: options.fetchJson,
      });
      if (
        version !== state.panelRenderVersions[slotId]
        || state.drag.active || !data
      ) return false;
      return await ComparisonView.render({
        state,
        slot,
        data,
        source: item.source,
        plotConfig: options.mapPlotConfig,
        attachInteractions: MapSelection.attach,
      });
    } catch (error) {
      if (!options.handleExpiredData(error)) {
        PanelSlot.setError(slot, error.detail || error.message || "比较请求失败");
      }
      return false;
    } finally {
      if (version === state.panelRenderVersions[slotId]) {
        PanelSlot.setLoading(slot, false);
      }
    }
  }

  async function renderSlot(slotId) {
    if (!options?.state.meta || !options.state.panelSlots[slotId].enabled) {
      return false;
    }
    const run = ++renderRun;
    return options.state.isComparison
      ? renderComparisonSlot(slotId, run)
      : renderNormalSlot(slotId, run);
  }

  async function renderActive() {
    return renderSlot(options.state.activeAnalysisSlot);
  }

  async function renderAll() {
    if (!options?.state.meta) return false;
    const run = ++renderRun;
    return Promise.all(enabledSlots(options.state).map(slotId => (
      options.state.isComparison
        ? renderComparisonSlot(slotId, run)
        : renderNormalSlot(slotId, run)
    )));
  }

  function linkedView(source, volume) {
    if (!options.state.isComparison) return volume ? "volume3d" : "layer2d";
    const suffix = source === "difference"
      ? "Difference" : source.toUpperCase();
    return volume ? `comparisonVolume${suffix}` : `comparison${suffix}`;
  }

  function alignLinkedViews(source = null) {
    const state = options.state;
    if (!state.linked3d2d) return;
    const activeView = state.panelSlots[state.activeAnalysisSlot].viewType;
    const selectedSource = source
      || PanelRegistry.definitions[activeView]?.source
      || "a";
    state.panelSlots.left.viewType = linkedView(selectedSource, true);
    state.panelSlots.right.viewType = linkedView(selectedSource, false);
  }

  async function toggleLinked() {
    const state = options.state;
    await TimelineController.stop({ waitForActive: true });
    if (state.linked3d2d) {
      SessionStore.endLinked();
      refreshSelectors();
      await RangeControls.save(options.fetchJson);
      await options.onActivate?.(state.activeAnalysisSlot);
      await renderAll();
      return;
    }

    const sourceSlot = state.activeAnalysisSlot;
    const sourceView = state.panelSlots[sourceSlot].viewType;
    const comparisonSource = PanelRegistry.definitions[sourceView]?.source || "a";
    SessionStore.beginLinked(sourceSlot);
    const source = panelState(sourceSlot);
    if (source.varType !== "3d") {
      const candidates = [state.last3dVariable, "ss"].filter(Boolean);
      const fallback = candidates.find(variable => (
        state.meta?.variables?.[variable]
        && !state.meta.vars_2d.includes(variable)
      ));
      if (!fallback) {
        SessionStore.endLinked();
        document.dispatchEvent(new CustomEvent("pisces:linked-notice", {
          detail: { message: "当前数据没有可用于三维联动的变量" },
        }));
        return;
      }
      source.variable = fallback;
      source.varType = "3d";
      source.isVector = (
        state.meta.vars_vector.includes(fallback) || fallback === "mwd"
      );
      const configuration = source.varConfig[fallback] || {};
      source.colorRange = (
        Number.isFinite(configuration.min) && Number.isFinite(configuration.max)
          ? [configuration.min, configuration.max] : null
      );
      source.depthRange = (
        configuration.depth_min != null && configuration.depth_max != null
          ? [configuration.depth_min, configuration.depth_max] : null
      );
      source.valueRange = (
        configuration.value_min != null && configuration.value_max != null
          ? [configuration.value_min, configuration.value_max] : null
      );
      SessionStore.remember3dVariable(fallback);
      document.dispatchEvent(new CustomEvent("pisces:linked-notice", {
        detail: {
          message: `已切换到${VariableRegistry.labels[fallback] || fallback}`,
        },
      }));
    }
    SessionStore.syncLinked(sourceSlot);
    alignLinkedViews(comparisonSource);
    state.panelSlots.left.enabled = true;
    state.panelSlots.right.enabled = true;
    SessionStore.activate("left");
    refreshSelectors();
    await RangeControls.save(options.fetchJson);
    await options.onActivate?.("left");
    await renderAll();
  }

  function playbackRequests(dateIndex) {
    if (!options?.state.meta) return [];
    const slotIds = options.state.linked3d2d
      ? enabledSlots(options.state)
      : [options.state.activeAnalysisSlot];
    return slotIds.map(slotId => {
      const state = panelState(slotId);
      const item = definition(state, slotId);
      const config = state.varConfig[state.variable] || {};
      if (state.isComparison) {
        return {
          url: item.volume
            ? VolumeView.comparisonRequestUrl(
              state, item.source, dateIndex, "preview"
            )
            : ComparisonView.requestUrl({
              depthIdx: state.depthIdx,
              variable: state.variable,
              dateIdx: dateIndex,
              is2d: state.varType === "2d",
              colorRange: state.colorRange,
              colorscale: config.colorscale,
              quiverStep: state.isVector ? state.quiverStep : null,
              region: state.region,
              points: state.points,
            }),
        };
      }
      return {
        url: item === PanelRegistry.definitions.volume3d
          ? VolumeView.requestUrl(state, dateIndex, "preview")
          : LayerView.requestUrl(state, state.depthIdx, state.points, dateIndex),
      };
    });
  }

  async function closeSlot(slotId) {
    const state = options.state;
    if (state.linked3d2d) return;
    if (enabledSlots(state).length <= 1) return;
    await TimelineController.stop({ waitForActive: true });
    state.panelSlots[slotId].enabled = false;
    state.panelRenderVersions[slotId] += 1;
    purgeSlot(slotId);
    if (state.activeAnalysisSlot === slotId) {
      SessionStore.activate(slotId === "left" ? "right" : "left");
    }
    updateActiveState(state);
    await RangeControls.save(options.fetchJson);
    await options.onActivate?.(state.activeAnalysisSlot);
  }

  async function openSlot(slotId) {
    await TimelineController.stop({ waitForActive: true });
    options.state.panelSlots[slotId].enabled = true;
    SessionStore.activate(slotId);
    refreshSelectors();
    await RangeControls.save(options.fetchJson);
    await options.onActivate?.(slotId);
    await renderSlot(slotId);
  }

  function handlePanelCommand(event) {
    const { action, slotId } = event.detail || {};
    if (!options) return;
    if (action === "toggle-3d2d") {
      void toggleLinked();
      return;
    }
    if (!["left", "right"].includes(slotId)) return;
    if (action === "activate") void activate(slotId);
    else if (action === "open") void openSlot(slotId);
    else if (action === "close") void closeSlot(slotId);
  }

  function initialize(config) {
    options = config;
    document.removeEventListener("pisces:panel-command", handlePanelCommand);
    document.addEventListener("pisces:panel-command", handlePanelCommand);
    PanelRegistry.initializeSlots(config.state);
    ["left", "right"].forEach(slotId => {
      const slot = PanelSlot.get(slotId);
      populateSelector(config.state, slot);
      slot.select.onchange = async () => {
        await activate(slotId);
        const previous = config.state.panelSlots[slotId].viewType;
        const next = slot.select.value;
        if (previous !== next) purgeSlot(slotId);
        config.state.panelSlots[slotId].viewType = next;
        if (config.state.linked3d2d) {
          const source = PanelRegistry.definitions[next]?.source || "a";
          SessionStore.syncLinked(slotId);
          alignLinkedViews(source);
        }
        await RangeControls.save(config.fetchJson);
        refreshSelectors();
        if (config.state.linked3d2d) await renderAll();
        else await renderSlot(slotId);
        await config.renderProfile();
      };
      slot.root.querySelector(".slot-header").onmousedown = () => {
        void activate(slotId);
      };
      if (slot.close) {
        slot.close.onmousedown = event => event.stopPropagation();
        slot.close.onclick = () => closeSlot(slotId);
      }
      if (slot.openOther) {
        slot.openOther.onmousedown = event => event.stopPropagation();
        slot.openOther.onclick = () => openSlot(
          slotId === "left" ? "right" : "left"
        );
      }
    });
    refreshSelectors();
  }

  function invalidate(slotId = null) {
    renderRun += 1;
    const slots = slotId ? [slotId] : ["left", "right"];
    slots.forEach(id => { options.state.panelRenderVersions[id] += 1; });
  }

  return {
    initialize,
    renderAll,
    renderActive,
    renderSlot,
    playbackRequests,
    refreshSelectors,
    activate,
    invalidate,
    purgeSlot,
    alignLinkedViews,
  };
})();
