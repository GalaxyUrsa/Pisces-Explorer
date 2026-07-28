/** Variable selection, dimension mode and vector-density controls. */
const VariableControls = (() => {
  let eventController = null;

  function updateLabels(labels, units, variable) {
    document.getElementById(
      "value-range-label"
    ).textContent = labels[variable] || "值";
    document.getElementById(
      "value-range-unit"
    ).textContent = units[variable] || "";
  }

  function applyDimensionMode(state) {
    const is2d = state.varType === "2d";
    const depthSlider = document.getElementById("depth-slider");
    const depthSelect = document.getElementById("depth-select");
    const quiverRow = document.getElementById("quiver-density-row");
    const modeCard = document.getElementById("mode-point")?.closest(".side-card");
    const depthCard = depthSelect?.closest(".side-card");

    depthSlider.disabled = is2d;
    depthSelect.disabled = is2d;
    depthCard.style.opacity = is2d ? "0.4" : "";
    quiverRow.classList.toggle("hidden", !state.isVector);
    modeCard.style.opacity = is2d ? "0.4" : "";
    document.querySelectorAll('input[name="mode"]').forEach(radio => {
      radio.disabled = is2d;
    });
    document.querySelectorAll(".analysis-tab").forEach(button => {
      button.disabled = is2d;
    });

    PanelController.refreshSelectors();
    requestAnimationFrame(() => {
      PanelSlot.resizeVisible();
      setTimeout(PanelSlot.resizeVisible, 150);
    });
  }

  function initialize({
    state,
    labels,
    units,
    rangeControls,
    renderVolume,
    renderLayer,
    renderProfile,
  }) {
    eventController?.abort();
    eventController = new AbortController();
    const listenerOptions = { signal: eventController.signal };

    const quiverStep = document.getElementById("quiver-step");
    const quiverLabel = document.getElementById("quiver-step-label");
    quiverStep.addEventListener("input", () => {
      state.quiverStep = Number.parseInt(quiverStep.value);
      quiverLabel.textContent = `步长 ${state.quiverStep}`;
      renderLayer(state.depthIdx, state.points);
    }, listenerOptions);

    document.querySelectorAll(".var-card").forEach(card => {
      card.classList.toggle("active", card.dataset.var === state.variable);
      card.addEventListener("click", () => {
        document.querySelectorAll(".var-card").forEach(item => {
          item.classList.remove("active");
        });
        card.classList.add("active");
        const variable = card.dataset.var;
        sessionStorage.setItem("lastVariable", variable);
        state.variable = variable;
        state.varType = state.meta.vars_2d.includes(variable) ? "2d" : "3d";
        state.isVector = (
          state.meta.vars_vector.includes(variable) || variable === "mwd"
        );
        rangeControls.selectVariable(variable);
        updateLabels(labels, units, variable);
        applyDimensionMode(state);
        if (state.varType === "3d") renderVolume();
        renderLayer(state.depthIdx, state.points);
        renderProfile();
      }, listenerOptions);
    });

    document.querySelectorAll(".var-group-header").forEach(header => {
      header.addEventListener("click", () => {
        const body = document.getElementById(
          `var-group-${header.dataset.group}`
        );
        const arrow = header.querySelector(".var-group-arrow");
        const isOpen = !body.classList.contains("hidden");
        body.classList.toggle("hidden", isOpen);
        if (arrow) arrow.textContent = isOpen ? "▶" : "▼";
      }, listenerOptions);
    });

    updateLabels(labels, units, state.variable);
    return { applyDimensionMode: () => applyDimensionMode(state) };
  }

  return { initialize };
})();
