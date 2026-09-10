/** Shared A/B/difference request cache and target-driven comparison renderer. */
const ComparisonView = (() => {
  const cachePromises = new Map();
  const savedRanges = new Map();

  function createRequestKey(options, actualDepth) {
    return JSON.stringify({
      depth: actualDepth,
      variable: options.variable,
      date: options.dateIdx,
      colorRange: options.colorRange,
      colorscale: options.colorscale,
      quiverStep: options.quiverStep,
      region: options.region,
      points: options.points,
    });
  }

  function requestUrl(options) {
    const actualDepth = options.is2d ? 0 : options.depthIdx;
    const params = new URLSearchParams({
      variable: options.variable,
      date_idx: options.dateIdx,
    });
    if (options.points.length) {
      params.set("points", JSON.stringify(options.points));
    }
    if (options.colorRange) {
      params.set("cmin", options.colorRange[0]);
      params.set("cmax", options.colorRange[1]);
    }
    if (options.colorscale) params.set("colorscale", options.colorscale);
    if (options.quiverStep) params.set("step", options.quiverStep);
    RegionControls.appendQuery(params, options.region);
    return `/api/comparison/layer/${actualDepth}?${params}`;
  }

  function load(options) {
    const actualDepth = options.is2d ? 0 : options.depthIdx;
    const key = createRequestKey(options, actualDepth);
    if (cachePromises.has(key)) return cachePromises.get(key);
    const promise = options.fetchJson(
      requestUrl(options)
    ).catch(error => {
      cachePromises.delete(key);
      throw error;
    });
    if (cachePromises.size >= 4) {
      cachePromises.delete(cachePromises.keys().next().value);
    }
    cachePromises.set(key, promise);
    return promise;
  }

  function figureFor(data, source) {
    return source === "difference"
      ? data.figures.difference
      : data.figures[source];
  }

  function titleFor(data, source) {
    const stats = data.stats?.[source];
    const change = data.change_from_previous?.[source];
    const statsText = stats?.mean == null ? "" : ` · 均值 ${stats.mean.toFixed(3)}`;
    const changeText = change == null ? ""
      : change === 0 ? " · 较前帧无变化"
        : ` · 较前帧最大变化 ${change.toFixed(3)}`;
    if (source === "difference") {
      const metrics = data.metrics || {};
      const metricText = metrics.mae == null ? "无有效数据"
        : `MAE ${metrics.mae.toFixed(3)} · RMSE ${metrics.rmse.toFixed(3)}`;
      return `差值 A−B · ${data.date} · ${metricText}`;
    }
    const sourceDate = data.source_dates?.[source] || data.date;
    return `序列 ${source.toUpperCase()} · ${sourceDate}${statsText}${changeText}`;
  }

  function rangeUpdate(eventData) {
    const values = [
      eventData["xaxis.range[0]"], eventData["xaxis.range[1]"],
      eventData["yaxis.range[0]"], eventData["yaxis.range[1]"],
    ];
    if (values.some(value => value == null)) return null;
    return {
      "xaxis.range": values.slice(0, 2),
      "yaxis.range": values.slice(2),
    };
  }

  function attachRangeSync(graph, slotId) {
    graph.removeAllListeners?.("plotly_relayout");
    graph.on("plotly_relayout", eventData => {
      const update = rangeUpdate(eventData);
      if (!update) return;
      savedRanges.set(slotId, update);
    });
  }

  async function render({ state, slot, data, source, plotConfig, attachInteractions }) {
    if (!data) return false;
    const figure = figureFor(data, source);
    await Plotly.react(slot.graph, figure.data, figure.layout, plotConfig);
    LayerView.updateQuiverInfo(data.quiver?.[source]);
    slot.title.textContent = titleFor(data, source);
    slot.source.textContent = source === "difference"
      ? "数据来源：序列 A−序列 B"
      : `数据来源：序列 ${source.toUpperCase()}`;
    slot.graph.dataset.viewKind = "comparison";
    const savedRange = savedRanges.get(slot.id);
    if (savedRange) await Plotly.relayout(slot.graph, savedRange);
    attachRangeSync(slot.graph, slot.id);
    attachInteractions(slot.graph, slot.id);
    return true;
  }

  function reset() {
    cachePromises.clear();
    savedRanges.clear();
  }

  return { load, render, requestUrl, reset };
})();
