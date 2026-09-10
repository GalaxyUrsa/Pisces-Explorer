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
    const depthCard = depthSelect?.closest(".side-card");

    depthSlider.disabled = is2d;
    depthSelect.disabled = is2d;
    if (depthCard) depthCard.style.opacity = is2d ? "0.4" : "";
    quiverRow.classList.toggle("hidden", !state.isVector);
    document.querySelectorAll(".analysis-tab").forEach(button => {
      button.disabled = is2d;
    });
    const mapRegionButton = document.getElementById("region-select-map");
    const activeDefinition = PanelRegistry.definitions[
      state.panelSlots[state.activeAnalysisSlot].viewType
    ];
    if (mapRegionButton) mapRegionButton.disabled = !activeDefinition?.selectable;

    PanelController.refreshSelectors();
    requestAnimationFrame(() => {
      PanelSlot.resizeVisible();
      setTimeout(PanelSlot.resizeVisible, 150);
    });
  }

  function initialize({
    state,
    apiFetch,
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
    const quiverInput = document.getElementById("quiver-step-input");
    const applyQuiverStep = async value => {
      TimelineController.stop();
      const parsed = Math.max(1, Math.min(40, Number.parseInt(value)));
      if (!Number.isFinite(parsed)) return;
      state.quiverStep = parsed;
      if (state.linked3d2d) {
        SessionStore.syncLinked(state.activeAnalysisSlot, ["quiverStep"]);
      }
      quiverInput.value = parsed;
      quiverStep.value = Math.max(10, parsed);
      await RangeControls.save(apiFetch);
      if (state.linked3d2d) PanelController.renderSlot("right");
      else renderLayer(state.depthIdx, state.points);
      PiscesUIEvents.panel(state);
    };
    quiverStep.addEventListener("input", () => {
      applyQuiverStep(quiverStep.value);
    }, listenerOptions);
    quiverInput.addEventListener("change", () => {
      applyQuiverStep(quiverInput.value);
    }, listenerOptions);
    quiverInput.value = state.quiverStep;
    quiverStep.value = Math.max(10, state.quiverStep);

    document.querySelectorAll(".var-card").forEach(card => {
      card.classList.toggle("active", card.dataset.var === state.variable);
      card.addEventListener("click", async () => {
        TimelineController.stop();
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
        if (state.varType === "3d") SessionStore.remember3dVariable(variable);
        if (state.varType === "3d") state.last3dVariable = variable;
        rangeControls.selectVariable(variable);
        updateLabels(labels, units, variable);
        applyDimensionMode(state);
        if (state.linked3d2d) {
          SessionStore.syncLinked(state.activeAnalysisSlot);
          PanelController.alignLinkedViews();
        }
        PiscesUIEvents.panel(SessionStore.state);
        await RangeControls.save(apiFetch);
        if (state.linked3d2d) await PanelController.renderAll();
        else await renderLayer(state.depthIdx, state.points);
        await renderProfile();
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
