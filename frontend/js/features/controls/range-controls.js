/** Colorbar, depth-range and value-range configuration controls. */
const RangeControls = (() => {
  let eventController = null;

  function input(id) {
    return document.getElementById(id);
  }

  function setValue(id, value) {
    input(id).value = value ?? "";
  }

  async function save(apiFetch, configuration) {
    try {
      await apiFetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(configuration),
      });
    } catch {
      // Keep local controls usable when persistence is unavailable.
    }
  }

  async function loadConfiguration(state, apiFetch, defaults) {
    const variables = Object.keys(defaults);
    try {
      const saved = await apiFetch("/api/config");
      variables.forEach(variable => {
        state.varConfig[variable] = {
          ...defaults[variable],
          ...(saved[variable] || {}),
        };
      });
      if (Array.isArray(saved.visible_layers)) {
        state.varConfig.visible_layers = saved.visible_layers;
      }
    } catch {
      variables.forEach(variable => {
        state.varConfig[variable] = { ...defaults[variable] };
      });
    }
  }

  function syncInputs(configuration) {
    setValue("cmin", "");
    setValue("cmax", "");
    if (configuration.color_min && configuration.color_max) {
      setValue("colorscale-select", "");
      setValue("color-min-swatch", configuration.color_min);
      setValue("color-min-hex", configuration.color_min);
      setValue("color-max-swatch", configuration.color_max);
      setValue("color-max-hex", configuration.color_max);
    } else {
      setValue("colorscale-select", configuration.colorscale || "");
      setValue("color-min-hex", "");
      setValue("color-max-hex", "");
      setValue("color-min-swatch", "#000000");
      setValue("color-max-swatch", "#000000");
    }
    setValue("depth-min", configuration.depth_min);
    setValue("depth-max", configuration.depth_max);
    setValue("speed-min", configuration.value_min);
    setValue("speed-max", configuration.value_max);
  }

  function initializeColorInputs(colorscales, listenerOptions) {
    const select = input("colorscale-select");
    select.innerHTML = "";
    colorscales.forEach(name => {
      const option = document.createElement("option");
      option.value = name;
      option.textContent = name;
      select.appendChild(option);
    });

    function link(swatchId, hexId) {
      input(swatchId).addEventListener("input", () => {
        input(hexId).value = input(swatchId).value;
        select.value = "";
      }, listenerOptions);
      input(hexId).addEventListener("input", () => {
        if (/^#[0-9a-fA-F]{6}$/.test(input(hexId).value)) {
          input(swatchId).value = input(hexId).value;
          select.value = "";
        }
      }, listenerOptions);
    }
    link("color-min-swatch", "color-min-hex");
    link("color-max-swatch", "color-max-hex");
    select.addEventListener("change", () => {
      setValue("color-min-hex", "");
      setValue("color-max-hex", "");
      setValue("color-min-swatch", "#000000");
      setValue("color-max-swatch", "#000000");
    }, listenerOptions);
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
    const colorscaleSelect = initializeColorInputs(
      colorscales, listenerOptions
    );

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
      syncInputs(configuration);
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
      await save(apiFetch, state.varConfig);
      renderProfile();
    };

    input("cbar-apply").onclick = async () => {
      const minimum = Number.parseFloat(input("cmin").value);
      const maximum = Number.parseFloat(input("cmax").value);
      if (Number.isNaN(minimum) || Number.isNaN(maximum)) return;
      const minHex = input("color-min-hex").value.trim();
      const maxHex = input("color-max-hex").value.trim();
      const custom = (
        /^#[0-9a-fA-F]{6}$/.test(minHex)
        && /^#[0-9a-fA-F]{6}$/.test(maxHex)
      );
      state.varConfig[state.variable] = {
        ...state.varConfig[state.variable],
        min: minimum,
        max: maximum,
        colorscale: custom
          ? null
          : (
            colorscaleSelect.value
            || defaults[state.variable].colorscale
          ),
        color_min: custom ? minHex : null,
        color_max: custom ? maxHex : null,
      };
      state.colorRange = [minimum, maximum];
      colorbar.setRange(minimum, maximum);
      await save(apiFetch, state.varConfig);
      renderVolume();
      renderLayer(state.depthIdx, state.points);
      renderProfile();
    };

    selectVariable(state.variable, true);
    return { selectVariable };
  }

  return { initialize, save };
})();

