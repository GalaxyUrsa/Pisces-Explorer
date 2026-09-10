/** Interactive background map used only by the Simulator workflow page. */
const SimulatorMapInteraction = (() => {
  const EARTH_RADIUS_KM = 6371;
  const OVERLAY_POINT_COUNT = 96;
  let ranges = null;
  let graphReady = false;

  function element(id) {
    return document.getElementById(id);
  }

  function numberValue(id) {
    return Number(element(id).value);
  }

  function setStatus(message, type = "") {
    const status = element("simulator-preview-status");
    status.textContent = message;
    status.className = `workflow-status${type ? ` ${type}` : ""}`;
  }

  function setSummary() {
    const lon = numberValue("simulator-lon");
    const lat = numberValue("simulator-lat");
    const center = Number.isFinite(lon) && Number.isFinite(lat)
      ? `${lon.toFixed(3)}°, ${lat.toFixed(3)}°`
      : "—";
    element("simulator-summary-center").textContent = center;
    element("simulator-summary-radius").textContent =
      `${element("simulator-radius").value || "—"} km`;
    element("simulator-summary-amplitude").textContent =
      `${element("simulator-amplitude").value || "—"} cm`;
    element("simulator-summary-depth").textContent =
      `${element("simulator-depth").value || "—"} m`;
    element("simulator-summary-kind").textContent =
      element("simulator-kind").selectedOptions[0]?.textContent || "—";
    element("simulator-summary-decay").textContent =
      element("simulator-decay").selectedOptions[0]?.textContent || "—";
  }

  function centerIsInside(lon, lat) {
    return ranges
      && lon >= ranges.lon[0] && lon <= ranges.lon[1]
      && lat >= ranges.lat[0] && lat <= ranges.lat[1];
  }

  function radiusBoundary(lon, lat, radiusKm) {
    const angularDistance = radiusKm / EARTH_RADIUS_KM;
    const latitude = lat * Math.PI / 180;
    const longitude = lon * Math.PI / 180;
    const x = [];
    const y = [];
    for (let index = 0; index <= OVERLAY_POINT_COUNT; index += 1) {
      const bearing = 2 * Math.PI * index / OVERLAY_POINT_COUNT;
      const pointLatitude = Math.asin(
        Math.sin(latitude) * Math.cos(angularDistance)
        + Math.cos(latitude) * Math.sin(angularDistance) * Math.cos(bearing)
      );
      const pointLongitude = longitude + Math.atan2(
        Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(latitude),
        Math.cos(angularDistance)
          - Math.sin(latitude) * Math.sin(pointLatitude)
      );
      let longitudeDegrees = pointLongitude * 180 / Math.PI;
      while (longitudeDegrees - lon > 180) longitudeDegrees -= 360;
      while (longitudeDegrees - lon < -180) longitudeDegrees += 360;
      x.push(longitudeDegrees);
      y.push(pointLatitude * 180 / Math.PI);
    }
    return { x, y };
  }

  async function updateOverlay() {
    setSummary();
    if (!graphReady) return;
    const graph = element("simulator-preview-map");
    const lon = numberValue("simulator-lon");
    const lat = numberValue("simulator-lat");
    const radiusKm = numberValue("simulator-radius");
    if (
      !Number.isFinite(lon) || !Number.isFinite(lat)
      || !Number.isFinite(radiusKm) || radiusKm <= 0
      || !centerIsInside(lon, lat)
    ) {
      await Plotly.restyle(graph, { x: [[]], y: [[]] }, [1, 2]);
      setStatus("当前涡心超出背景场范围，请在地图内点击或修改经纬度。", "error");
      return;
    }
    const boundary = radiusBoundary(lon, lat, radiusKm);
    await Plotly.restyle(
      graph,
      { x: [boundary.x], y: [boundary.y] },
      [1]
    );
    await Plotly.restyle(graph, { x: [[lon]], y: [[lat]] }, [2]);
    setStatus("地图已就绪；点击有效海洋区域可重新设置涡心。", "success");
  }

  function previewFormData() {
    const form = new FormData();
    if (element("simulator-input-source").value === "hub") {
      let reference = null;
      try {
        reference = JSON.parse(element("simulator-hub-input").value);
      } catch {}
      if (!reference) {
        throw new Error("请选择 Pisces-Hub 背景场。");
      }
      form.append("hub_asset_id", reference.id);
      if (reference.member) form.append("hub_member", reference.member);
    } else {
      const file = element("simulator-input").files[0];
      if (!file) throw new Error("请选择本地背景场 NetCDF。");
      form.append("file", file);
    }
    return form;
  }

  async function loadPreview() {
    const button = element("simulator-preview-load");
    button.disabled = true;
    button.textContent = "正在加载…";
    setStatus("正在读取表层流速并构建背景场地图…", "loading");
    try {
      const response = await ApiClient.fetchJson("/api/simulator/preview", {
        method: "POST",
        body: previewFormData(),
      });
      ranges = { lon: response.lon_range, lat: response.lat_range };
      const figure = response.figure;
      figure.data.push(
        {
          type: "scatter",
          mode: "lines",
          x: [],
          y: [],
          fill: "toself",
          fillcolor: "rgba(37, 99, 235, 0.13)",
          line: { color: "#2563eb", width: 2 },
          hoverinfo: "skip",
          showlegend: false,
          meta: { role: "eddy-radius" },
        },
        {
          type: "scatter",
          mode: "markers",
          x: [],
          y: [],
          marker: {
            size: 12,
            color: "#ef4444",
            line: { color: "#ffffff", width: 2 },
          },
          hovertemplate: "涡心<br>%{x:.3f}°, %{y:.3f}°<extra></extra>",
          showlegend: false,
          meta: { role: "eddy-center" },
        }
      );
      const graph = element("simulator-preview-map");
      await Plotly.react(
        graph,
        figure.data,
        figure.layout,
        PlotlyConfig.map
      );
      graphReady = true;
      graph.removeAllListeners?.("plotly_click");
      graph.on("plotly_click", async event => {
        const point = event?.points?.[0];
        if (!point || point.curveNumber !== 0) return;
        element("simulator-lon").value = Number(point.x).toFixed(4);
        element("simulator-lat").value = Number(point.y).toFixed(4);
        element("simulator-lon").dispatchEvent(
          new Event("input", { bubbles: true })
        );
        element("simulator-lat").dispatchEvent(
          new Event("input", { bubbles: true })
        );
        await updateOverlay();
      });
      const lon = numberValue("simulator-lon");
      const lat = numberValue("simulator-lat");
      if (!centerIsInside(lon, lat)) {
        element("simulator-lon").value =
          ((ranges.lon[0] + ranges.lon[1]) / 2).toFixed(4);
        element("simulator-lat").value =
          ((ranges.lat[0] + ranges.lat[1]) / 2).toFixed(4);
        element("simulator-lon").dispatchEvent(
          new Event("input", { bubbles: true })
        );
        element("simulator-lat").dispatchEvent(
          new Event("input", { bubbles: true })
        );
      }
      await updateOverlay();
    } catch (error) {
      setStatus(
        `背景场加载失败：${error.detail || error.message}`,
        "error"
      );
    } finally {
      button.disabled = false;
      button.textContent = "加载背景场地图";
    }
  }

  function clearPreview() {
    ranges = null;
    graphReady = false;
    const graph = element("simulator-preview-map");
    if (graph.data) Plotly.purge(graph);
    graph.replaceChildren();
    const placeholder = document.createElement("span");
    placeholder.textContent = "背景场已更改，请重新加载地图";
    graph.appendChild(placeholder);
    setStatus("背景场已更改，请重新加载地图。");
  }

  function initialize() {
    setSummary();
    element("simulator-preview-load").onclick = loadPreview;
    [
      "simulator-lon",
      "simulator-lat",
      "simulator-radius",
      "simulator-amplitude",
      "simulator-depth",
      "simulator-kind",
      "simulator-decay",
    ].forEach(id => {
      element(id).addEventListener("input", updateOverlay);
      element(id).addEventListener("change", updateOverlay);
    });
    [
      "simulator-input-source",
      "simulator-input",
      "simulator-hub-input",
    ].forEach(id => {
      element(id).addEventListener("change", clearPreview);
    });
  }

  return { initialize, loadPreview, clearPreview };
})();
