<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";
import legacyPage from "../../../pages/index.html?raw";
import AppHeader from "../components/AppHeader.vue";
import ExplorerPanelSwitcher from "../explorer/ExplorerPanelSwitcher.vue";
import { purgeExplorerPlots, startLegacyExplorerRuntime } from "../explorer/legacy-runtime";
import { mountExplorerSidebar } from "../explorer/sidebar-layout";
import RegionSelector, { type RegionSelection } from "./RegionSelector.vue";

declare global {
  interface Window { PISCES_API_PREFIX?: string }
}

window.PISCES_API_PREFIX = "/region";
const selection = ref<RegionSelection | null>(null);
const loading = ref(true);
const runtimeError = ref("");
let sidebarApp: { unmount(): void } | null = null;
let started = false;

function workspaceMarkup(): string {
  const match = legacyPage.match(
    /(<div id="main-screen"[\s\S]*?)\s*<script src="\/static\/js\/core\/session-store\.js/,
  );
  if (!match) throw new Error("无法读取区域分析工作区模板。");
  return match[1].trim();
}
const markup = workspaceMarkup();

async function startWorkspace(): Promise<void> {
  if (started) return;
  started = true;
  await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
  sidebarApp = mountExplorerSidebar();
  await startLegacyExplorerRuntime();
}

async function confirmed(value: RegionSelection): Promise<void> {
  selection.value = value;
  try {
    await startWorkspace();
  } catch (error) {
    runtimeError.value = error instanceof Error ? error.message : String(error);
  }
}

async function changeRegion(): Promise<void> {
  if (!window.confirm("更换区域将清空当前 Region 数据和分析状态，是否继续？")) return;
  await fetch("/region/api/session", { method: "DELETE" });
  window.location.reload();
}

function handleSessionCleared(): void {
  window.location.reload();
}

onMounted(async () => {
  document.addEventListener("pisces:region-session-cleared", handleSessionCleared);
  try {
    const response = await fetch("/region/api/selection");
    const data = await response.json();
    if (data.ready) {
      selection.value = data.selection;
      await startWorkspace();
    }
  } catch (error) {
    runtimeError.value = error instanceof Error ? error.message : String(error);
  } finally {
    loading.value = false;
  }
});

onBeforeUnmount(() => {
  document.removeEventListener("pisces:region-session-cleared", handleSessionCleared);
  sidebarApp?.unmount();
  purgeExplorerPlots();
  delete window.PISCES_API_PREFIX;
});
</script>

<template>
  <AppHeader active="region">
    <template v-if="selection" #context>
      <div class="region-header-context">
        <div class="region-header-summary">
          <strong>区域分析</strong>
          <span>{{ selection.fixed_size ? "中心点 240×240 km" : `${selection.width_km.toFixed(0)}×${selection.height_km.toFixed(0)} km` }}</span>
        </div>
        <ExplorerPanelSwitcher />
        <button class="region-change-btn" type="button" @click="changeRegion">更换区域</button>
      </div>
    </template>
  </AppHeader>
  <div v-if="loading" class="region-loading">正在恢复区域状态…</div>
  <RegionSelector v-else-if="!selection" @confirmed="confirmed" />
  <template v-else>
    <div v-if="runtimeError" class="workflow-status error explorer-runtime-error">{{ runtimeError }}</div>
    <div v-html="markup"></div>
  </template>
</template>
