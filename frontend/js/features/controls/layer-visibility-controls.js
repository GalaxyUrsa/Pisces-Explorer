/** Visible-layer selection for the three-dimensional volume view. */
const LayerVisibilityControls = (() => {
  function initialize({ state, apiFetch, renderVolume }) {
    const container = document.getElementById("layer-vis-checks");
    const count = state.meta.depths.length;
    const saved = Array.isArray(state.varConfig.visible_layers)
      ? state.varConfig.visible_layers.filter(index => index >= 0 && index < count)
      : null;
    state.visibleLayers = saved
      ? state.meta.depths.map((_, index) => saved.includes(index))
      : state.meta.depths.map((_, index) => index % 2 === 0);

    container.innerHTML = "";
    state.meta.depths.forEach((depth, index) => {
      const label = document.createElement("label");
      label.className = "layer-check-item";
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.dataset.idx = index;
      checkbox.checked = state.visibleLayers[index];
      label.appendChild(checkbox);
      label.appendChild(
        document.createTextNode(`${index + 1} - ${depth.toFixed(1)} m`)
      );
      container.appendChild(label);
    });

    const checkboxes = () => (
      container.querySelectorAll("input[type=checkbox]")
    );
    document.getElementById("layer-vis-all").onclick = () => {
      checkboxes().forEach(checkbox => { checkbox.checked = true; });
    };
    document.getElementById("layer-vis-none").onclick = () => {
      checkboxes().forEach(checkbox => { checkbox.checked = false; });
    };
    document.getElementById("layer-vis-even").onclick = () => {
      checkboxes().forEach(checkbox => {
        checkbox.checked = Number.parseInt(checkbox.dataset.idx) % 2 === 0;
      });
    };
    document.getElementById("layer-vis-apply").onclick = async () => {
      checkboxes().forEach(checkbox => {
        state.visibleLayers[Number.parseInt(checkbox.dataset.idx)] = (
          checkbox.checked
        );
      });
      state.varConfig.visible_layers = state.visibleLayers
        .map((visible, index) => visible ? index : -1)
        .filter(index => index >= 0);
      await RangeControls.save(apiFetch, state.varConfig);
      renderVolume();
    };
  }

  return { initialize };
})();

