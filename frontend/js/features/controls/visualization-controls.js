/** Compose independent visualization-setting controllers. */
const VisualizationControls = (() => {
  async function initialize(context) {
    const rangeControls = await RangeControls.initialize(context);
    const variableControls = VariableControls.initialize({
      ...context,
      rangeControls,
    });
    LayerVisibilityControls.initialize(context);
    return {
      applyDimensionMode: variableControls.applyDimensionMode,
    };
  }

  return { initialize };
})();

