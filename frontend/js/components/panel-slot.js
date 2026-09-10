/** DOM shell helpers for one reusable visualization slot. */
const PanelSlot = (() => {
  function get(slotId) {
    const root = document.getElementById(`slot-${slotId}`);
    return {
      id: slotId,
      root,
      graph: root.querySelector(".slot-graph"),
      title: root.querySelector(".slot-title"),
      source: root.querySelector(".slot-source"),
      select: root.querySelector(".slot-view-select"),
      loading: root.querySelector(".slot-loading"),
      error: root.querySelector(".slot-error"),
      close: root.querySelector(".slot-close"),
      openOther: root.querySelector(".slot-open-other"),
    };
  }

  function setLoading(slot, visible) {
    slot.loading.classList.toggle("hidden", !visible);
  }

  function setError(slot, message = "") {
    slot.error.textContent = message;
    slot.error.classList.toggle("hidden", !message);
  }

  function setActive(slot, active) {
    slot.root.classList.toggle("active-analysis-slot", active);
    slot.root.setAttribute("aria-current", active ? "true" : "false");
  }

  function resizeVisible() {
    document.querySelectorAll(".slot-graph, #profile-graph").forEach(graph => {
      if (graph.offsetParent) Plotly.Plots.resize(graph);
    });
  }

  return { get, setLoading, setError, setActive, resizeVisible };
})();
