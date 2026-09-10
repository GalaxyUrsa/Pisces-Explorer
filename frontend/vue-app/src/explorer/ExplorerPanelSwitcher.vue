<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive } from "vue";

type PanelId = "left" | "right";

interface PanelSummary {
  enabled: boolean;
  viewLabel: string;
  sourceLabel: string;
  variableLabel: string;
}

interface PanelDetail {
  active?: PanelId;
  linked3d2d?: boolean;
  panels?: Partial<Record<PanelId, Partial<PanelSummary>>>;
}

const state = reactive({
  ready: false,
  active: "right" as PanelId,
  linked3d2d: false,
  linkedNotice: "",
  panels: {
    left: { enabled: true, viewLabel: "水平切层", sourceLabel: "当前数据", variableLabel: "" },
    right: { enabled: true, viewLabel: "水平切层", sourceLabel: "当前数据", variableLabel: "" },
  } as Record<PanelId, PanelSummary>,
});

const enabledPanels = computed(() => (
  (["left", "right"] as PanelId[]).filter(id => state.panels[id].enabled)
));

function windowName(id: PanelId): string {
  return id === "left" ? "左窗口" : "右窗口";
}

function tooltip(id: PanelId): string {
  const item = state.panels[id];
  if (!item.enabled) return `打开${windowName(id)}`;
  return `${windowName(id)} · ${item.viewLabel} · ${item.sourceLabel}${item.variableLabel ? ` · ${item.variableLabel}` : ""}`;
}

function command(action: "activate" | "open" | "close" | "toggle-3d2d", slotId?: PanelId): void {
  document.dispatchEvent(new CustomEvent("pisces:panel-command", {
    detail: { action, slotId },
  }));
}

function select(id: PanelId): void {
  command(state.panels[id].enabled ? "activate" : "open", id);
}

function close(id: PanelId): void {
  command("close", id);
}

function handleWorkspace(event: Event): void {
  state.ready = (event as CustomEvent<{ ready?: boolean }>).detail?.ready === true;
}

function handlePanel(event: Event): void {
  const detail = (event as CustomEvent<PanelDetail>).detail || {};
  if (detail.active) state.active = detail.active;
  if (typeof detail.linked3d2d === "boolean") state.linked3d2d = detail.linked3d2d;
  (["left", "right"] as PanelId[]).forEach(id => {
    if (detail.panels?.[id]) Object.assign(state.panels[id], detail.panels[id]);
  });
}

let noticeTimer: number | undefined;
function handleLinkedNotice(event: Event): void {
  state.linkedNotice = (event as CustomEvent<{ message?: string }>).detail?.message || "";
  window.clearTimeout(noticeTimer);
  noticeTimer = window.setTimeout(() => { state.linkedNotice = ""; }, 3500);
}

onMounted(() => {
  document.addEventListener("pisces:workspace-state", handleWorkspace);
  document.addEventListener("pisces:panel-state", handlePanel);
  document.addEventListener("pisces:linked-notice", handleLinkedNotice);
});

onBeforeUnmount(() => {
  document.removeEventListener("pisces:workspace-state", handleWorkspace);
  document.removeEventListener("pisces:panel-state", handlePanel);
  document.removeEventListener("pisces:linked-notice", handleLinkedNotice);
  window.clearTimeout(noticeTimer);
});
</script>

<template>
  <div v-if="state.ready && enabledPanels.length" class="header-panel-switcher" aria-label="当前编辑窗口">
    <span class="header-panel-switcher-label">当前编辑窗口</span>
    <div class="header-panel-options">
      <div
        v-for="id in (['left', 'right'] as PanelId[])"
        :key="id"
        class="header-panel-option"
        :class="{ active: state.panels[id].enabled && state.active === id, closed: !state.panels[id].enabled }"
      >
        <button class="header-panel-select" type="button" :aria-pressed="state.panels[id].enabled && state.active === id" :title="tooltip(id)" @click="select(id)">
          <strong>{{ state.panels[id].enabled ? windowName(id) : `＋ 打开${windowName(id)}` }}</strong>
          <small v-if="state.panels[id].enabled">{{ state.panels[id].sourceLabel }}</small>
        </button>
        <button v-if="state.panels[id].enabled && enabledPanels.length > 1" class="header-panel-close" type="button" :disabled="state.linked3d2d" :aria-label="`关闭${windowName(id)}`" :title="state.linked3d2d ? '请先退出 3D/2D 联动' : `关闭${windowName(id)}`" @click="close(id)">×</button>
      </div>
    </div>
    <button
      class="header-link-toggle"
      :class="{ active: state.linked3d2d }"
      type="button"
      :aria-pressed="state.linked3d2d"
      :title="state.linked3d2d ? '退出 3D/2D 联动并恢复原窗口' : '左侧三维场与右侧水平切层联动'"
      @click="command('toggle-3d2d')"
    >
      3D/2D <small v-if="state.linked3d2d">联动中</small>
    </button>
    <span v-if="state.linkedNotice" class="header-link-notice">{{ state.linkedNotice }}</span>
  </div>
</template>
