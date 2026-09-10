<script setup lang="ts">
import { formatBytes, historyParameters } from "../shared/format";
import type { HubAsset, WorkflowKind } from "../shared/types";

defineProps<{
  kind: WorkflowKind;
  assets: HubAsset[];
  loading: boolean;
  error: string;
}>();

defineEmits<{
  load: [asset: HubAsset];
  remove: [asset: HubAsset];
}>();
</script>

<template>
  <div class="workflow-history-list">
    <p v-if="loading" class="workflow-history-empty">正在读取 Pisces-Hub…</p>
    <p v-else-if="error" class="workflow-history-empty">{{ error }}</p>
    <p v-else-if="!assets.length" class="workflow-history-empty">暂无历史记录。</p>
    <article
      v-for="asset in assets"
      v-else
      :key="asset.id"
      class="workflow-history-item"
    >
      <div class="workflow-history-info">
        <strong>{{ asset.name }}</strong>
        <small>
          <template v-if="asset.kind === 'series'">{{ asset.files.length }} 帧 · </template>
          {{ formatBytes(asset.size_bytes) }} · {{ new Date(asset.created_at_ms).toLocaleString() }}
        </small>
        <div class="workflow-history-parameters">
          <span v-for="item in historyParameters(kind, asset)" :key="item">{{ item }}</span>
        </div>
        <small v-if="asset.input?.filename" class="workflow-history-source">
          输入：{{ asset.input.filename }}
        </small>
      </div>
      <div class="workflow-history-actions">
        <button class="workflow-history-btn" @click="$emit('load', asset)">在 Explorer 查看</button>
        <button class="workflow-history-btn danger" @click="$emit('remove', asset)">删除</button>
      </div>
    </article>
  </div>
</template>
