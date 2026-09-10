/** Point selection and draggable markers for dynamic map slots. */
const MapSelection = (() => {
  let stateRef = null;
  let renderSpatialRef = null;
  let renderProfileRef = null;
  let onDragStartRef = null;
  let onRegionSelectedRef = null;
  let profileDebounceTimer = null;
  const dragBoundGraphs = new WeakSet();

  function configure({
    state, renderLayer, renderProfile, onDragStart, onRegionSelected,
  }) {
    stateRef = state;
    renderSpatialRef = renderLayer;
    renderProfileRef = renderProfile;
    onDragStartRef = onDragStart || null;
    onRegionSelectedRef = onRegionSelected || null;
  }

  function pixelToLatLon(graph, clientX, clientY) {
    const layout = graph._fullLayout;
    const rectangle = graph.getBoundingClientRect();
    return {
      lon: Math.max(stateRef.meta.lon_range[0], Math.min(
        stateRef.meta.lon_range[1],
        layout.xaxis.p2d(clientX - rectangle.left - layout.margin.l)
      )),
      lat: Math.max(stateRef.meta.lat_range[0], Math.min(
        stateRef.meta.lat_range[1],
        layout.yaxis.p2d(clientY - rectangle.top - layout.margin.t)
      )),
    };
  }

  function updateMarkers() {
    document.querySelectorAll('.slot-graph[data-selectable="true"]').forEach(graph => {
      if (graph.dataset.slotId !== stateRef.activeAnalysisSlot) return;
      if (!stateRef.points.length) return;
      const pointTrace = graph.data?.findIndex(
        trace => trace.meta?.role === "selection-points"
      );
      if (pointTrace == null || pointTrace < 0) return;
      Plotly.restyle(graph, {
        x: [stateRef.points.map(point => point.lon)],
        y: [stateRef.points.map(point => point.lat)],
      }, [pointTrace]);
      if (stateRef.points.length === 2) {
        const lineTrace = graph.data?.findIndex(
          trace => trace.meta?.role === "selection-line"
        );
        if (lineTrace == null || lineTrace < 0) return;
        Plotly.restyle(graph, {
          x: [[stateRef.points[0].lon, stateRef.points[1].lon]],
          y: [[stateRef.points[0].lat, stateRef.points[1].lat]],
        }, [lineTrace]);
      }
    });
  }

  function debounceProfile() {
    clearTimeout(profileDebounceTimer);
    profileDebounceTimer = setTimeout(() => renderProfileRef(), 150);
  }

  function bindDrag(graph, slotId) {
    if (dragBoundGraphs.has(graph)) return;
    dragBoundGraphs.add(graph);
    graph.addEventListener("mousedown", event => {
      if (
        stateRef.activeAnalysisSlot !== slotId
        || stateRef.drag.hoverPointIdx === null
      ) return;
      event.stopPropagation();
      event.preventDefault();
      onDragStartRef?.();
      PanelController.invalidate();
      stateRef.drag.active = true;
      stateRef.drag.pointIdx = stateRef.drag.hoverPointIdx;
      graph.style.cursor = "grabbing";
      document.body.style.userSelect = "none";

      function onMove(moveEvent) {
        if (!stateRef.drag.active) return;
        stateRef.points[stateRef.drag.pointIdx] = pixelToLatLon(
          graph, moveEvent.clientX, moveEvent.clientY
        );
        stateRef.pointsByMode[stateRef.mode] = stateRef.points.map(point => ({
          ...point,
        }));
        updateMarkers();
        debounceProfile();
      }

      async function onUp() {
        stateRef.drag.active = false;
        graph.style.cursor = (
          stateRef.drag.hoverPointIdx !== null ? "grab" : ""
        );
        document.body.style.userSelect = "";
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
        clearTimeout(profileDebounceTimer);
        await renderSpatialRef(stateRef.depthIdx, stateRef.points);
        await renderProfileRef();
      }

      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    }, { capture: true });
  }

  function attach(graph, slotId) {
    graph.dataset.selectable = "true";
    graph.dataset.slotId = slotId;
    graph.removeAllListeners?.("plotly_click");
    graph.removeAllListeners?.("plotly_hover");
    graph.removeAllListeners?.("plotly_unhover");
    graph.removeAllListeners?.("plotly_selected");
    graph.on("plotly_selected", async event => {
      if (!stateRef.regionSelecting || stateRef.activeAnalysisSlot !== slotId) {
        return;
      }
      const x = event?.range?.x;
      const y = event?.range?.y;
      stateRef.regionSelecting = false;
      await Plotly.relayout(graph, { dragmode: "pan" });
      if (!x || !y) return;
      await onRegionSelectedRef?.([
        Math.min(...x), Math.max(...x), Math.min(...y), Math.max(...y),
      ]);
    });
    graph.on("plotly_hover", event => {
      if (stateRef.activeAnalysisSlot !== slotId || !event?.points?.length) return;
      const point = event.points[0];
      stateRef.drag.hoverPointIdx = (
        point.data?.meta?.role === "selection-points"
      )
        ? point.pointIndex : null;
      graph.style.cursor = stateRef.drag.hoverPointIdx === null ? "" : "grab";
    });
    graph.on("plotly_unhover", () => {
      if (!stateRef.drag.active) {
        stateRef.drag.hoverPointIdx = null;
        graph.style.cursor = "";
      }
    });
    graph.on("plotly_click", async event => {
      await PanelController.activate(slotId);
      if (
        stateRef.drag.active || stateRef.regionSelecting
        || !event?.points?.length
      ) return;
      const point = event.points[0];
      const lon = Number(point.x);
      const lat = Number(point.y);
      const role = point.data?.meta?.role;
      if (
        !Number.isFinite(lon) || !Number.isFinite(lat)
        || role === "selection-points" || role === "selection-line"
      ) return;
      const selected = { lat, lon };
      stateRef.points = stateRef.mode === "point"
        ? [selected] : [...stateRef.points, selected].slice(-2);
      stateRef.pointsByMode[stateRef.mode] = stateRef.points.map(item => ({
        ...item,
      }));
      await renderSpatialRef(stateRef.depthIdx, stateRef.points);
      await renderProfileRef();
    });
    bindDrag(graph, slotId);
  }

  function initDrag() {
    // Drag listeners are bound when a selectable slot is rendered.
  }

  function startRegionSelection() {
    const slotId = stateRef?.activeAnalysisSlot;
    const graph = slotId ? PanelSlot.get(slotId)?.graph : null;
    if (!graph || graph.dataset.selectable !== "true") return false;
    stateRef.regionSelecting = true;
    Plotly.relayout(graph, { dragmode: "select" });
    return true;
  }

  return {
    configure, attach, initDrag, updateMarkers, startRegionSelection,
  };
})();
