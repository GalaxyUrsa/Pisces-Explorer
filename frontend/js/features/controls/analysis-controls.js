/**
 * Depth and point/transect mode controls.
 */
const AnalysisControls = (() => {
  let eventController = null;
  const valueRangeIds = [
    "value-range-divider",
    "value-range-label",
    "speed-min",
    "value-range-sep",
    "speed-max",
    "value-range-unit",
    "value-dual-wrap",
  ];

  function updateValueRangeVisibility(state) {
    const visible = state.mode === "transect";
    valueRangeIds.forEach(id => {
      const element = document.getElementById(id);
      if (element) element.style.display = visible ? "" : "none";
    });
  }

  function updateModeTabs(state) {
    ["point", "transect"].forEach(mode => {
      const button = document.getElementById(`analysis-tab-${mode}`);
      const active = state.mode === mode;
      button?.classList.toggle("active", active);
      button?.setAttribute("aria-pressed", String(active));
    });
  }

  function initialize({
    state,
    apiFetch,
    onDepthChange,
    renderLayer,
    renderProfile,
  }) {
    eventController?.abort();
    eventController = new AbortController();
    const listenerOptions = { signal: eventController.signal };
    const depthSelect = document.getElementById("depth-select");
    const depthSlider = document.getElementById("depth-slider");
    depthSelect.innerHTML = "";
    state.meta.depths.forEach((depth, index) => {
      const option = document.createElement("option");
      option.value = index;
      option.textContent = `${depth.toFixed(1)} m`;
      depthSelect.appendChild(option);
    });
    depthSlider.min = 0;
    depthSlider.max = state.meta.depths.length - 1;
    depthSlider.value = state.depthIdx;
    depthSelect.value = state.depthIdx;

    let depthDebounceTimer = null;
    depthSelect.addEventListener("change", () => {
      const index = Number.parseInt(depthSelect.value);
      depthSlider.value = index;
      onDepthChange(index);
    }, listenerOptions);
    depthSlider.addEventListener("input", () => {
      const index = Number.parseInt(depthSlider.value);
      depthSelect.value = index;
      clearTimeout(depthDebounceTimer);
      depthDebounceTimer = setTimeout(() => onDepthChange(index), 120);
    }, listenerOptions);

    async function selectMode(mode) {
      if (state.mode === mode) return;
      TimelineController.stop();
      state.pointsByMode[state.mode] = state.points.map(point => ({
        ...point,
      }));
      state.mode = mode;
      state.points = state.pointsByMode[state.mode].map(point => ({
        ...point,
      }));
      updateValueRangeVisibility(state);
      updateModeTabs(state);
      PiscesUIEvents.panel(state);
      await RangeControls.save(apiFetch);
      await renderLayer(state.depthIdx, state.points);
      await renderProfile();
    }
    updateValueRangeVisibility(state);
    updateModeTabs(state);
    document.getElementById("analysis-tab-point").onclick = () => {
      void selectMode("point");
    };
    document.getElementById("analysis-tab-transect").onclick = () => {
      void selectMode("transect");
    };

    document.getElementById("clear-btn").onclick = () => {
      TimelineController.stop();
      state.points = [];
      state.pointsByMode[state.mode] = [];
      renderLayer(state.depthIdx, []);
      renderProfile();
    };
  }

  return { initialize };
})();
