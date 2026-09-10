const LEGACY_SCRIPTS = [
  "/static/js/core/session-store.js?v=3",
  "/static/js/core/panel-registry.js?v=3",
  "/static/js/core/variable-registry.js?v=1",
  "/static/js/core/api-client.js?v=1",
  "/static/js/core/playback-cache.js?v=1",
  "/static/js/core/plotly-config.js?v=1",
  "/static/js/core/ui-events.js?v=1",
  "/static/js/components/dual-range.js?v=1",
  "/static/js/components/timeline.js?v=4",
  "/static/js/components/panel-resizer.js?v=1",
  "/static/js/components/panel-slot.js?v=2",
  "/static/js/components/sidebar-controller.js?v=5",
  "/static/js/components/sidebar-sections.js?v=5",
  "/static/js/features/controls/region-controls.js?v=3",
  "/static/js/interactions/map-selection.js?v=1",
  "/static/js/features/dataset/upload-controller.js?v=5",
  "/static/js/features/controls/range-controls.js?v=4",
  "/static/js/features/controls/layer-visibility-controls.js?v=3",
  "/static/js/features/controls/variable-controls.js?v=4",
  "/static/js/features/controls/visualization-controls.js?v=1",
  "/static/js/features/controls/analysis-controls.js?v=3",
  "/static/js/features/workspace/controller.js?v=6",
  "/static/js/features/comparison/view.js?v=7",
  "/static/js/features/volume/view.js?v=6",
  "/static/js/features/layer/view.js?v=4",
  "/static/js/features/profile/view.js?v=4",
  "/static/js/features/transect/view.js?v=4",
  "/static/js/features/workspace/panel-controller.js?v=5",
  "/static/app.js?v=30",
] as const;

function loadScript(source: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[data-explorer-runtime="${source}"]`,
    );
    if (existing?.dataset.loaded === "true") {
      resolve();
      return;
    }
    const script = existing || document.createElement("script");
    script.src = source;
    script.dataset.explorerRuntime = source;
    script.onload = () => {
      script.dataset.loaded = "true";
      resolve();
    };
    script.onerror = () => reject(new Error(`无法加载 Explorer 模块：${source}`));
    if (!existing) document.body.appendChild(script);
  });
}

export async function startLegacyExplorerRuntime(): Promise<void> {
  for (const source of LEGACY_SCRIPTS) await loadScript(source);
}

export function purgeExplorerPlots(): void {
  document.querySelectorAll<HTMLElement>(
    "#slot-left-graph, #slot-right-graph, #profile-graph",
  ).forEach(graph => Plotly.purge(graph));
}
