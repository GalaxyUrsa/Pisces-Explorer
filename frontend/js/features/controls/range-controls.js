/** Colorbar, depth-range and value-range configuration controls. */
const RangeControls = (() => {
  let eventController = null;

  function input(id) {
    return document.getElementById(id);
  }

  function setValue(id, value) {
    input(id).value = value ?? "";
  }

  async function save(apiFetch) {
    try {
      await apiFetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(SessionStore.serializeConfiguration()),
      });
    } catch {
      // Keep local controls usable when persistence is unavailable.
    }
  }

  async function loadConfiguration(state, apiFetch, defaults) {
    if (state.configLoaded) return;
    try {
      const saved = await apiFetch("/api/config");
      SessionStore.applyConfiguration(saved, defaults, state.meta);
    } catch {
      SessionStore.applyConfiguration({}, defaults, state.meta);
    }
  }

  function syncInputs(configuration, defaultConfiguration) {
    setValue("cmin", "");
    setValue("cmax", "");
    setValue(
      "colorscale-select",
      configuration.colorscale || defaultConfiguration.colorscale || ""
    );
    setValue("depth-min", configuration.depth_min);
    setValue("depth-max", configuration.depth_max);
    setValue("speed-min", configuration.value_min);
    setValue("speed-max", configuration.value_max);
  }

  function initializeColorscaleSelect(colorscales) {
    const select = input("colorscale-select");
    select.innerHTML = "";
    colorscales.forEach(name => {
      const option = document.createElement("option");
      option.value = name;
      option.textContent = name;
      select.appendChild(option);
    });

    return select;
  }

  async function initialize({
    state,
    apiFetch,
    defaults,
    colorscales,
    renderVolume,
    renderLayer,
    renderProfile,
  }) {
    eventController?.abort();
    eventController = new AbortController();
    const listenerOptions = { signal: eventController.signal };
    await loadConfiguration(state, apiFetch, defaults);
    const colorscaleSelect = initializeColorscaleSelect(colorscales);

    const depthLow = state.meta.depths[0];
    const depthHigh = state.meta.depths[state.meta.depths.length - 1];
    const initialRange = state.meta.variables[state.variable];
    const colorbar = DualRange.create({
      wrap: input("cbar-dual-wrap"),
      minInput: input("cmin"),
      maxInput: input("cmax"),
      thumbMin: input("cbar-thumb-min"),
      thumbMax: input("cbar-thumb-max"),
      fillEl: input("cbar-dual-fill"),
      min: initialRange.min,
      max: initialRange.max,
      signal: eventController.signal,
    });
    const depth = DualRange.create({
      wrap: input("depth-dual-wrap"),
      minInput: input("depth-min"),
      maxInput: input("depth-max"),
      thumbMin: input("depth-thumb-min"),
      thumbMax: input("depth-thumb-max"),
      fillEl: input("depth-dual-fill"),
      min: depthLow,
      max: depthHigh,
      signal: eventController.signal,
    });
    const value = DualRange.create({
      wrap: input("value-dual-wrap"),
      minInput: input("speed-min"),
      maxInput: input("speed-max"),
      thumbMin: input("value-thumb-min"),
      thumbMax: input("value-thumb-max"),
      fillEl: input("value-dual-fill"),
      min: initialRange.min,
      max: initialRange.max,
      signal: eventController.signal,
    });

    function selectVariable(variable, clearOptionalInputs = false) {
      const configuration = state.varConfig[variable];
      const variableRange = state.meta.variables[variable];
      state.colorRange = [configuration.min, configuration.max];
      state.depthRange = (
        configuration.depth_min != null && configuration.depth_max != null
          ? [configuration.depth_min, configuration.depth_max]
          : null
      );
      state.valueRange = (
        configuration.value_min != null && configuration.value_max != null
          ? [configuration.value_min, configuration.value_max]
          : null
      );
      syncInputs(configuration, defaults[variable]);
      colorbar.setBounds(variableRange.min, variableRange.max);
      colorbar.setRange(configuration.min, configuration.max);
      value.setBounds(variableRange.min, variableRange.max);
      if (state.valueRange) value.setRange(...state.valueRange);
      else value.setRange(variableRange.min, variableRange.max);
      if (state.depthRange) depth.setRange(...state.depthRange);
      else depth.setRange(depthLow, depthHigh);
      if (clearOptionalInputs || !state.valueRange) {
        setValue("speed-min", "");
        setValue("speed-max", "");
      }
      if (clearOptionalInputs || !state.depthRange) {
        setValue("depth-min", "");
        setValue("depth-max", "");
      }
    }

    input("range-apply-btn").onclick = async () => {
      TimelineController.stop();
      const depthMin = Number.parseFloat(input("depth-min").value);
      const depthMax = Number.parseFloat(input("depth-max").value);
      const valueMin = Number.parseFloat(input("speed-min").value);
      const valueMax = Number.parseFloat(input("speed-max").value);
      state.depthRange = (
        Number.isNaN(depthMin) || Number.isNaN(depthMax)
          ? null
          : [depthMin, depthMax]
      );
      state.valueRange = (
        Number.isNaN(valueMin) || Number.isNaN(valueMax)
          ? null
          : [valueMin, valueMax]
      );
      const configuration = state.varConfig[state.variable];
      configuration.depth_min = state.depthRange ? depthMin : null;
      configuration.depth_max = state.depthRange ? depthMax : null;
      configuration.value_min = state.valueRange ? valueMin : null;
      configuration.value_max = state.valueRange ? valueMax : null;
      if (state.linked3d2d) {
        SessionStore.syncLinked(
          state.activeAnalysisSlot,
          ["depthRange", "valueRange", "varConfig"]
        );
      }
      await save(apiFetch);
      renderProfile();
    };

    input("cbar-apply").onclick = async () => {
      TimelineController.stop();
      const minimum = Number.parseFloat(input("cmin").value);
      const maximum = Number.parseFloat(input("cmax").value);
      if (Number.isNaN(minimum) || Number.isNaN(maximum)) return;
      state.varConfig[state.variable] = {
        ...state.varConfig[state.variable],
        min: minimum,
        max: maximum,
        colorscale: (
          colorscaleSelect.value
          || defaults[state.variable].colorscale
        ),
        color_min: null,
        color_max: null,
      };
      state.colorRange = [minimum, maximum];
      colorbar.setRange(minimum, maximum);
      if (state.linked3d2d) SessionStore.syncLinked(state.activeAnalysisSlot);
      await save(apiFetch);
      PiscesUIEvents.panel(state);
      if (state.linked3d2d) await PanelController.renderAll();
      else await renderLayer(state.depthIdx, state.points);
      await renderProfile();
    };

    colorscaleSelect.addEventListener("change", async () => {
      TimelineController.stop();
      state.varConfig[state.variable] = {
        ...state.varConfig[state.variable],
        colorscale: (
          colorscaleSelect.value
          || defaults[state.variable].colorscale
        ),
      };
      if (state.linked3d2d) SessionStore.syncLinked(state.activeAnalysisSlot);
      await save(apiFetch);
      PiscesUIEvents.panel(state);
      if (state.linked3d2d) await PanelController.renderAll();
      else await renderLayer(state.depthIdx, state.points);
      await renderProfile();
    }, listenerOptions);

    selectVariable(state.variable, true);
    return { selectVariable };
  }

  return { initialize, save };
})();
