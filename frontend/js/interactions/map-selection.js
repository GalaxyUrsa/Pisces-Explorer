/** Point selection and draggable markers for dynamic map slots. */
const MapSelection = (() => {
  let stateRef = null;
  let renderSpatialRef = null;
  let renderProfileRef = null;
  let onDragStartRef = null;
  let profileDebounceTimer = null;
  const dragBoundGraphs = new WeakSet();

  function configure({ state, renderLayer, renderProfile, onDragStart }) {
    stateRef = state;
    renderSpatialRef = renderLayer;
    renderProfileRef = renderProfile;
    onDragStartRef = onDragStart || null;
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
      if (!stateRef.points.length) return;
      Plotly.restyle(graph, {
        x: [stateRef.points.map(point => point.lon)],
        y: [stateRef.points.map(point => point.lat)],
      }, [1]);
      if (stateRef.points.length === 2) {
        Plotly.restyle(graph, {
          x: [[stateRef.points[0].lon, stateRef.points[1].lon]],
          y: [[stateRef.points[0].lat, stateRef.points[1].lat]],
        }, [2]);
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
    graph.removeAllListeners?.("plotly_click");
    graph.removeAllListeners?.("plotly_hover");
    graph.removeAllListeners?.("plotly_unhover");
    graph.on("plotly_hover", event => {
      if (stateRef.activeAnalysisSlot !== slotId || !event?.points?.length) return;
      const point = event.points[0];
      stateRef.drag.hoverPointIdx = point.curveNumber === 1
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
      PanelController.activate(slotId);
      if (stateRef.drag.active || !event?.points?.length) return;
      const point = event.points[0];
      if (point.x == null || point.y == null || point.curveNumber >= 1) return;
      const selected = { lat: point.y, lon: point.x };
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

  return { configure, attach, initDrag, updateMarkers };
})();
