/** Shared spatial-region input, validation and rendering coordination. */
const RegionControls = (() => {
  let options = null;
  let eventController = null;
  const inputIds = [
    "region-lon-min", "region-lon-max",
    "region-lat-min", "region-lat-max",
  ];

  function inputs() {
    return inputIds.map(id => document.getElementById(id));
  }

  function setInputs(region) {
    const bounds = region || [
      options.state.meta.lon_range[0],
      options.state.meta.lon_range[1],
      options.state.meta.lat_range[0],
      options.state.meta.lat_range[1],
    ];
    inputs().forEach((input, index) => {
      input.value = Number(bounds[index]).toFixed(4);
    });
  }

  function setStatus(message, type = "") {
    const element = document.getElementById("region-status");
    element.textContent = message;
    element.className = `region-status${type ? ` ${type}` : ""}`;
  }

  function readInputs() {
    const values = inputs().map(input => Number.parseFloat(input.value));
    const [lonMin, lonMax, latMin, latMax] = values;
    if (
      values.some(value => !Number.isFinite(value))
      || lonMin >= lonMax
      || latMin >= latMax
    ) {
      throw new Error("请输入递增且有效的四个区域边界");
    }
    const meta = options.state.meta;
    if (
      lonMin < meta.lon_range[0] || lonMax > meta.lon_range[1]
      || latMin < meta.lat_range[0] || latMax > meta.lat_range[1]
    ) {
      throw new Error("区域边界不能超出当前数据范围");
    }
    return values;
  }

  function keepPointsInside(region) {
    const [lonMin, lonMax, latMin, latMax] = region;
    let removed = 0;
    Object.keys(options.state.pointsByMode).forEach(mode => {
      const previous = options.state.pointsByMode[mode];
      const kept = previous.filter(point => (
        point.lon >= lonMin && point.lon <= lonMax
        && point.lat >= latMin && point.lat <= latMax
      ));
      removed += previous.length - kept.length;
      options.state.pointsByMode[mode] = kept;
    });
    options.state.points = options.state.pointsByMode[
      options.state.mode
    ].map(point => ({ ...point }));
    return removed;
  }

  function restoreSavedRegion() {
    const region = options.state.varConfig.region;
    if (!Array.isArray(region) || region.length !== 4) return null;
    const normalized = region.map(Number);
    const [lonMin, lonMax, latMin, latMax] = normalized;
    const meta = options.state.meta;
    if (
      normalized.some(value => !Number.isFinite(value))
      || lonMin >= lonMax
      || latMin >= latMax
      || lonMin < meta.lon_range[0]
      || lonMax > meta.lon_range[1]
      || latMin < meta.lat_range[0]
      || latMax > meta.lat_range[1]
    ) {
      return null;
    }
    return normalized;
  }

  async function saveRegion(region) {
    options.state.varConfig.region = region;
    if (options.state.linked3d2d) {
      SessionStore.syncLinked(options.state.activeAnalysisSlot, ["region", "varConfig"]);
    }
    await RangeControls.save(options.apiFetch);
  }

  async function rerender() {
    TimelineController.stop();
    ComparisonView.reset();
    PanelController.invalidate(options.state.activeAnalysisSlot);
    PiscesUIEvents.panel(options.state);
    if (options.state.linked3d2d) await PanelController.renderAll();
    else await options.renderLayer(options.state.depthIdx, options.state.points);
    await options.renderProfile();
  }

  async function applyRegion(region, source = "input") {
    try {
      const normalized = region.map(Number);
      setInputs(normalized);
      options.state.region = normalized;
      options.state.regionSelecting = false;
      await saveRegion(normalized);
      const removed = keepPointsInside(normalized);
      const message = (
        `区域：${normalized[0].toFixed(3)}–${normalized[1].toFixed(3)}°E，`
        + `${normalized[2].toFixed(3)}–${normalized[3].toFixed(3)}°N`
        + (removed ? `；已清除 ${removed} 个区域外选点` : "")
      );
      setStatus(message, removed ? "warning" : "active");
      await rerender();
      return true;
    } catch (error) {
      setStatus(error.detail || error.message, "error");
      return false;
    }
  }

  async function clearRegion() {
    options.state.region = null;
    options.state.regionSelecting = false;
    await saveRegion(null);
    setInputs(null);
    setStatus("当前使用完整数据区域");
    await rerender();
  }

  function appendQuery(params, region) {
    if (region) params.set("region", JSON.stringify(region));
  }

  function initialize(config) {
    options = config;
    eventController?.abort();
    eventController = new AbortController();
    const listenerOptions = { signal: eventController.signal };
    options.state.region = restoreSavedRegion();
    options.state.varConfig.region = options.state.region;
    setInputs(options.state.region);
    setStatus(
      options.state.region ? "当前使用已选区域" : "当前使用完整数据区域"
    );
    document.getElementById("region-apply").addEventListener(
      "click",
      () => {
        try {
          applyRegion(readInputs());
        } catch (error) {
          setStatus(error.message, "error");
        }
      },
      listenerOptions
    );
    document.getElementById("region-clear").addEventListener(
      "click", clearRegion, listenerOptions
    );
    document.getElementById("region-select-map").addEventListener(
      "click",
      () => {
        if (MapSelection.startRegionSelection()) {
          setStatus("请在当前二维分析窗口拖动框选区域", "selecting");
        }
      },
      listenerOptions
    );
  }

  return { initialize, applyRegion, appendQuery };
})();
