/**
 * Depth, point/transect mode and comparison-source controls.
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
    document.getElementById("analysis-tab-point")?.classList.toggle(
      "active", state.mode === "point"
    );
    document.getElementById("analysis-tab-transect")?.classList.toggle(
      "active", state.mode === "transect"
    );
  }

  function initialize({
    state,
    onDepthChange,
    renderLayer,
    renderProfile,
  }) {
    eventController?.abort();
    eventController = new AbortController();
    const listenerOptions = { signal: eventController.signal };
    const comparisonControl = document.getElementById(
      "comparison-analysis-control"
    );
    const comparisonSource = document.getElementById(
      "comparison-analysis-source"
    );
    comparisonControl.classList.toggle("hidden", !state.isComparison);
    comparisonSource.value = state.comparisonSource;
    comparisonSource.onchange = () => {
      state.comparisonSource = comparisonSource.value;
      renderProfile();
    };

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
    depthSlider.value = 0;

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

    document.querySelectorAll('input[name="mode"]').forEach(radio => {
      radio.checked = radio.value === "point";
      radio.addEventListener("change", () => {
        state.pointsByMode[state.mode] = state.points.map(point => ({
          ...point,
        }));
        state.mode = radio.value;
        state.points = state.pointsByMode[state.mode].map(point => ({
          ...point,
        }));
        document.getElementById("mode-point").classList.toggle(
          "active", state.mode === "point"
        );
        document.getElementById("mode-transect").classList.toggle(
          "active", state.mode === "transect"
        );
        updateValueRangeVisibility(state);
        updateModeTabs(state);
        renderLayer(state.depthIdx, state.points);
        renderProfile();
      }, listenerOptions);
    });
    state.mode = "point";
    updateValueRangeVisibility(state);
    updateModeTabs(state);
    document.getElementById("analysis-tab-point").onclick = () => {
      document.querySelector('input[name="mode"][value="point"]').click();
    };
    document.getElementById("analysis-tab-transect").onclick = () => {
      document.querySelector('input[name="mode"][value="transect"]').click();
    };

    document.getElementById("clear-btn").onclick = () => {
      state.points = [];
      state.pointsByMode[state.mode] = [];
      renderLayer(state.depthIdx, []);
      renderProfile();
    };
  }

  return { initialize };
})();
