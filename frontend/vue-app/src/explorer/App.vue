<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";
import legacyPage from "../../../pages/index.html?raw";
import AppHeader from "../components/AppHeader.vue";
import ExplorerPanelSwitcher from "./ExplorerPanelSwitcher.vue";
import { purgeExplorerPlots, startLegacyExplorerRuntime } from "./legacy-runtime";
import { mountExplorerSidebar } from "./sidebar-layout";

const runtimeError = ref("");
let sidebarApp: { unmount(): void } | null = null;

function workspaceMarkup(): string {
  const match = legacyPage.match(
    /(<div id="main-screen"[\s\S]*?)\s*<script src="\/static\/js\/core\/session-store\.js/,
  );
  if (!match) throw new Error("无法读取 Explorer 工作区模板。");
  return match[1].trim();
}

const markup = workspaceMarkup();

onMounted(async () => {
  try {
    sidebarApp = mountExplorerSidebar();
    await startLegacyExplorerRuntime();
  } catch (error) {
    runtimeError.value = error instanceof Error ? error.message : String(error);
  }
});

onBeforeUnmount(() => {
  sidebarApp?.unmount();
  purgeExplorerPlots();
});
</script>

<template>
  <AppHeader active="explorer">
    <template #context><ExplorerPanelSwitcher /></template>
  </AppHeader>
  <div v-if="runtimeError" class="workflow-status error explorer-runtime-error">
    {{ runtimeError }}
  </div>
  <div v-html="markup"></div>
</template>
