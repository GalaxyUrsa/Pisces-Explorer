/** Explicit state bridge from the existing Plotly controllers to Vue UI. */
const PiscesUIEvents = (() => {
  function workspace({ ready, label = "", mode = "" }) {
    document.dispatchEvent(new CustomEvent("pisces:workspace-state", {
      detail: { ready: Boolean(ready), label, mode },
    }));
  }

  function panel(state) {
    const active = state.activeAnalysisSlot;
    const current = state.panelSlots[active];
    const definition = PanelRegistry.definitions[current.viewType] || {};
    const depths = state.meta?.depths || [];
    const depth = depths[current.depthIdx];
    const selectedDate = document.getElementById("date-select")?.selectedOptions?.[0]?.textContent;
    const colorMin = document.getElementById("cmin")?.value;
    const colorMax = document.getElementById("cmax")?.value;
    const palette = document.getElementById("colorscale-select")?.selectedOptions?.[0];
    const checkedLayers = current.visibleLayers?.filter(Boolean).length;
    const totalLayers = current.visibleLayers?.length;
    const region = current.region;
    const sourceLabels = {
      a: "数据集 A",
      b: "数据集 B",
      difference: "差值 A−B",
    };
    const panels = Object.fromEntries(["left", "right"].map(slotId => {
      const slot = state.panelSlots[slotId];
      const slotDefinition = PanelRegistry.definitions[slot.viewType] || {};
      return [slotId, {
        enabled: Boolean(slot.enabled),
        viewLabel: slotDefinition.label || slot.viewType,
        sourceLabel: state.isComparison
          ? (sourceLabels[slotDefinition.source] || "对比数据")
          : "当前数据",
        variableLabel: VariableRegistry.labels[slot.variable] || slot.variable,
      }];
    }));
    document.dispatchEvent(new CustomEvent("pisces:panel-state", {
      detail: {
        active,
        linked3d2d: Boolean(state.linked3d2d),
        panels,
        sourceLabel: panels[active].sourceLabel,
        enabled: {
          left: state.panelSlots.left.enabled,
          right: state.panelSlots.right.enabled,
        },
        viewLabel: definition.label || current.viewType,
        variableLabel: VariableRegistry.labels[current.variable] || current.variable,
        depthLabel: current.varType === "3d" && depth != null
          ? `${Number(depth).toFixed(depth < 10 ? 1 : 0)} m` : "",
        dateLabel: (state.dates?.length || 0) > 1
          ? (selectedDate || `第 ${Number(current.dateIdx || 0) + 1} 帧`) : "",
        colorLabel: colorMin !== "" && colorMax !== ""
          ? `${colorMin} – ${colorMax}` : "自动范围",
        paletteLabel: palette?.textContent || palette?.value || "",
        quiverLabel: current.isVector ? `步长 ${current.quiverStep || 20}` : "",
        layerCountLabel: definition.requires3d && totalLayers
          ? `${checkedLayers || 0} / ${totalLayers} 层` : "",
        analysisLabel: current.varType === "3d"
          ? (current.mode === "transect" ? "两点断面" : "单点剖面") : "",
        regionLabel: Array.isArray(region)
          ? `${Number(region[0]).toFixed(1)}°–${Number(region[1]).toFixed(1)}°`
          : "完整区域",
        showTimeline: (state.dates?.length || 0) > 1,
        showDepth: current.varType === "3d",
        showVectors: Boolean(current.isVector),
        showVolumeLayers: Boolean(definition.requires3d),
        showAnalysis: current.varType === "3d",
        canSelectRegion: Boolean(definition.selectable),
        dateIndex: current.dateIdx,
        pointCount: current.points?.length || 0,
      },
    }));
  }

  return { workspace, panel };
})();
