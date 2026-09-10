<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref } from "vue";

type SidebarView = "data" | "controls";
type ModuleKey = "variables" | "timeline" | "depth" | "colorRange" | "palette" | "vectors" | "volumeLayers" | "region";
type PanelId = "left" | "right";

interface WorkspaceDetail { ready?: boolean; label?: string; mode?: string }
interface PanelDetail {
  active?: PanelId;
  enabled?: Record<PanelId, boolean>;
  sourceLabel?: string;
  viewLabel?: string;
  variableLabel?: string;
  depthLabel?: string;
  dateLabel?: string;
  colorLabel?: string;
  paletteLabel?: string;
  quiverLabel?: string;
  layerCountLabel?: string;
  analysisLabel?: string;
  regionLabel?: string;
  pointCount?: number;
  showTimeline?: boolean;
  showDepth?: boolean;
  showVectors?: boolean;
  showVolumeLayers?: boolean;
  showAnalysis?: boolean;
  canSelectRegion?: boolean;
}

const MODULES_KEY = "pisces.sidebar.modules.v1";
const COLLAPSED_KEY = "pisces.sidebar.collapsed";
const WIDTH_KEY = "pisces.sidebar.width.v2";

const modules: Array<{ key: ModuleKey; label: string; icon: string }> = [
  { key: "variables", label: "视图与变量", icon: "variables" },
  { key: "timeline", label: "时间", icon: "timeline" },
  { key: "depth", label: "深度", icon: "depth" },
  { key: "colorRange", label: "颜色范围", icon: "colors" },
  { key: "palette", label: "配色", icon: "colors" },
  { key: "vectors", label: "矢量密度", icon: "variables" },
  { key: "volumeLayers", label: "3D 显示层", icon: "depth" },
  { key: "region", label: "区域与选点", icon: "selection" },
];

const activeView = ref<SidebarView>("data");
const collapsed = ref(false);
const savedModuleKeys = new Set<ModuleKey>();
let resizeTimer: number | undefined;
const workspace = reactive({ ready: false, label: "未加载数据", mode: "" });
const panel = reactive({
  active: "right" as PanelId,
  enabled: { left: true, right: true },
  sourceLabel: "当前数据",
  viewLabel: "水平切层",
  variableLabel: "流速（合成）",
  depthLabel: "第 -- 层",
  dateLabel: "当前帧",
  colorLabel: "自动范围",
  paletteLabel: "",
  quiverLabel: "自动密度",
  layerCountLabel: "默认层",
  analysisLabel: "单点剖面",
  regionLabel: "完整区域",
  pointCount: 0,
  showTimeline: false,
  showDepth: true,
  showVectors: false,
  showVolumeLayers: false,
  showAnalysis: true,
  canSelectRegion: true,
});
const moduleOpen = reactive<Record<ModuleKey, boolean>>({
  variables: true,
  timeline: false,
  depth: false,
  colorRange: false,
  palette: false,
  vectors: false,
  volumeLayers: false,
  region: false,
});

const panelSummary = computed(() => `${panel.viewLabel} · ${panel.variableLabel}`);
const dataActionLabel = computed(() => {
  if (!workspace.ready) return "选择数据";
  return activeView.value === "data" ? "返回控制" : "管理数据";
});
const controlSummary = computed(() => [
  { label: "视图", value: panel.viewLabel },
  { label: "变量", value: panel.variableLabel },
  { label: "时间", value: panel.showTimeline ? panel.dateLabel : "" },
  { label: "深度", value: panel.showDepth ? panel.depthLabel : "" },
  { label: "范围", value: panel.colorLabel },
  { label: "配色", value: panel.paletteLabel },
  { label: "矢量", value: panel.showVectors ? panel.quiverLabel : "" },
  { label: "3D 层", value: panel.showVolumeLayers ? panel.layerCountLabel : "" },
  { label: "区域", value: panel.regionLabel },
  { label: "分析", value: panel.showAnalysis ? panel.analysisLabel : "" },
]);

function iconUrl(icon: string): string {
  return `/static/assets/icons/sidebar-icons.svg?v=1#${icon}`;
}

function moduleSummary(key: ModuleKey): string {
  const unavailable: Partial<Record<ModuleKey, string>> = {
    timeline: "单帧数据，无时间轴",
    depth: "表面变量，无深度维度",
    vectors: "当前变量不是矢量场",
    volumeLayers: "请先切换到三维场",
  };
  if (!moduleAvailable(key)) return unavailable[key] || "当前不可用";
  const summaries: Record<ModuleKey, string> = {
    variables: panelSummary.value,
    timeline: panel.dateLabel,
    depth: panel.depthLabel,
    colorRange: panel.colorLabel,
    palette: panel.paletteLabel || "颜色方案",
    vectors: panel.quiverLabel,
    volumeLayers: panel.layerCountLabel,
    region: panel.canSelectRegion ? panel.regionLabel : "当前视图不支持地图框选",
  };
  return summaries[key];
}

function moduleAvailable(key: ModuleKey): boolean {
  const contextual: Partial<Record<ModuleKey, boolean>> = {
    timeline: panel.showTimeline,
    depth: panel.showDepth,
    vectors: panel.showVectors,
    volumeLayers: panel.showVolumeLayers,
  };
  return contextual[key] ?? true;
}

function persistModules(): void {
  localStorage.setItem(MODULES_KEY, JSON.stringify(moduleOpen));
}

function applyVisibility(): void {
  document.getElementById("sidebar-data-pane")?.classList.toggle("vue-section-hidden", activeView.value !== "data");
  document.getElementById("sidebar-control-pane")?.classList.toggle(
    "vue-section-hidden", !workspace.ready || activeView.value !== "controls",
  );
  modules.forEach(item => {
    const shell = document.getElementById(`sidebar-module-${item.key}`);
    shell?.classList.toggle("module-collapsed", !moduleOpen[item.key]);
    shell?.classList.toggle("module-unavailable", !moduleAvailable(item.key));
  });
  const clear = document.getElementById("clear-btn") as HTMLButtonElement | null;
  if (clear) clear.disabled = panel.pointCount === 0;
}

function selectView(view: SidebarView): void {
  if (!workspace.ready && view === "controls") return;
  activeView.value = view;
  applyVisibility();
}

function toggleDataView(): void {
  if (!workspace.ready) {
    selectView("data");
    return;
  }
  selectView(activeView.value === "data" ? "controls" : "data");
}

function toggleModule(key: ModuleKey): void {
  moduleOpen[key] = !moduleOpen[key];
  savedModuleKeys.add(key);
  persistModules();
  applyVisibility();
}

function setCollapsed(value: boolean, persist = true): void {
  collapsed.value = value;
  const sidebar = document.querySelector<HTMLElement>(".sidebar");
  sidebar?.classList.toggle("collapsed", value);
  if (sidebar) {
    const savedWidth = Number(localStorage.getItem(WIDTH_KEY));
    const expandedWidth = Number.isFinite(savedWidth) ? Math.max(280, Math.min(380, savedWidth)) : 304;
    sidebar.style.width = `${value ? 52 : expandedWidth}px`;
    sidebar.style.minWidth = `${value ? 52 : 280}px`;
    sidebar.style.flexBasis = `${value ? 52 : expandedWidth}px`;
  }
  document.getElementById("main-screen")?.classList.toggle("sidebar-collapsed", value);
  if (persist && window.innerWidth > 760) localStorage.setItem(COLLAPSED_KEY, value ? "1" : "0");
  document.dispatchEvent(new CustomEvent("pisces:sidebar-toggle", { detail: { collapsed: value } }));
  window.clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(() => {
    if (typeof PanelSlot !== "undefined") PanelSlot.resizeVisible?.();
  }, 80);
}

function openFromRail(view: SidebarView): void {
  selectView(view);
  setCollapsed(false);
}

function handleWorkspace(event: Event): void {
  const detail = (event as CustomEvent<WorkspaceDetail>).detail || {};
  const wasReady = workspace.ready;
  workspace.ready = detail.ready === true;
  workspace.label = detail.label || (workspace.ready ? "当前数据" : "未加载数据");
  workspace.mode = detail.mode || "";
  if (!workspace.ready) selectView("data");
  else if (!wasReady || activeView.value === "data") selectView("controls");
  applyVisibility();
}

function handlePanel(event: Event): void {
  const detail = (event as CustomEvent<PanelDetail>).detail || {};
  if (detail.active) panel.active = detail.active;
  if (detail.enabled) panel.enabled = detail.enabled;
  (["sourceLabel", "viewLabel", "variableLabel", "depthLabel", "dateLabel", "colorLabel", "paletteLabel", "quiverLabel", "layerCountLabel", "analysisLabel", "regionLabel"] as const)
    .forEach(key => { if (typeof detail[key] === "string") panel[key] = detail[key]; });
  (["showTimeline", "showDepth", "showVectors", "showVolumeLayers", "showAnalysis", "canSelectRegion"] as const)
    .forEach(key => { if (typeof detail[key] === "boolean") panel[key] = detail[key]; });
  if (panel.showTimeline && !savedModuleKeys.has("timeline")) moduleOpen.timeline = true;
  if (panel.showDepth && !savedModuleKeys.has("depth")) moduleOpen.depth = true;
  panel.pointCount = Number(detail.pointCount || 0);
  applyVisibility();
}

function handleResize(): void {
  if (window.innerWidth <= 760 && !collapsed.value) setCollapsed(true, false);
}

function handleBackdrop(): void { setCollapsed(true, false) }

onMounted(async () => {
  try {
    const savedModules = JSON.parse(localStorage.getItem(MODULES_KEY) || "{}");
    modules.forEach(item => {
      if (typeof savedModules[item.key] === "boolean") {
        moduleOpen[item.key] = savedModules[item.key];
        savedModuleKeys.add(item.key);
      }
    });
  } catch { localStorage.removeItem(MODULES_KEY) }
  collapsed.value = window.innerWidth <= 760 || localStorage.getItem(COLLAPSED_KEY) === "1";
  setCollapsed(collapsed.value, false);
  document.addEventListener("pisces:workspace-state", handleWorkspace);
  document.addEventListener("pisces:panel-state", handlePanel);
  document.getElementById("sidebar-backdrop")?.addEventListener("click", handleBackdrop);
  const externalToggle = document.getElementById("sidebar-toggle");
  if (externalToggle) externalToggle.onclick = () => setCollapsed(!collapsed.value);
  window.addEventListener("resize", handleResize);
  await nextTick();
  applyVisibility();
});

onBeforeUnmount(() => {
  document.removeEventListener("pisces:workspace-state", handleWorkspace);
  document.removeEventListener("pisces:panel-state", handlePanel);
  document.getElementById("sidebar-backdrop")?.removeEventListener("click", handleBackdrop);
  window.removeEventListener("resize", handleResize);
  window.clearTimeout(resizeTimer);
});
</script>

<template>
  <div id="explorer-vue-sidebar" class="explorer-sidebar-tool">
    <div class="sidebar-tool-main glass-surface">
      <div class="sidebar-tool-topline">
        <button class="sidebar-data-status" type="button" :aria-expanded="activeView === 'data'" :title="dataActionLabel" @click="toggleDataView">
          <span class="sidebar-data-dot" :class="{ ready: workspace.ready }"></span>
          <span class="sidebar-data-copy"><strong>{{ workspace.label }}</strong><small>{{ workspace.mode || (workspace.ready ? "数据已就绪" : "点击选择 NetCDF") }}</small></span>
          <span class="sidebar-data-action">{{ dataActionLabel }}</span>
        </button>
        <button class="sidebar-collapse-button" type="button" aria-label="收起侧栏" @click="setCollapsed(true)"><svg viewBox="0 0 24 24"><use :href="iconUrl('collapse')" /></svg></button>
      </div>
      <div v-if="workspace.ready && activeView === 'controls'" class="sidebar-panel-context sidebar-panel-context-summary">
        <div class="sidebar-panel-current">
          <span>当前控制：{{ panel.active === "left" ? "左窗口" : "右窗口" }}</span>
          <strong>· {{ panel.sourceLabel || "—" }}</strong>
        </div>
        <dl class="sidebar-control-summary">
          <div v-for="item in controlSummary" :key="item.label">
            <dt>{{ item.label }}</dt>
            <dd :title="item.value || '—'">{{ item.value || "—" }}</dd>
          </div>
        </dl>
      </div>
    </div>

    <div class="sidebar-tool-rail" aria-label="侧栏功能导航">
      <button type="button" title="数据" @click="openFromRail('data')"><svg viewBox="0 0 24 24"><use :href="iconUrl('data')" /></svg></button>
      <button type="button" title="控制面板" :disabled="!workspace.ready" @click="openFromRail('controls')"><svg viewBox="0 0 24 24"><use :href="iconUrl('variables')" /></svg></button>
    </div>

    <Teleport v-for="item in modules" :key="item.key" :to="`#sidebar-module-header-${item.key}`">
      <button class="sidebar-module-toggle" type="button" :aria-expanded="moduleAvailable(item.key) && moduleOpen[item.key]" :disabled="!moduleAvailable(item.key)" @click="toggleModule(item.key)">
        <span class="sidebar-module-icon"><svg viewBox="0 0 24 24"><use :href="iconUrl(item.icon)" /></svg></span>
        <span class="sidebar-module-title"><strong>{{ item.label }}</strong><small>{{ moduleSummary(item.key) }}</small></span>
        <span class="sidebar-module-chevron">⌄</span>
      </button>
    </Teleport>
  </div>
</template>
