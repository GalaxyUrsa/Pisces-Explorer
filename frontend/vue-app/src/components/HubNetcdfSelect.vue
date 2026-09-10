<script setup lang="ts">
import type { HubAsset } from "../shared/types";

defineProps<{ modelValue: string; assets: HubAsset[] }>();
defineEmits<{ "update:modelValue": [value: string] }>();

function optionValue(asset: HubAsset, member: string | null): string {
  return JSON.stringify({ id: asset.id, member });
}
</script>

<template>
  <select
    :value="modelValue"
    @change="$emit('update:modelValue', ($event.target as HTMLSelectElement).value)"
  >
    <option value="">{{ assets.length ? "请选择 Pisces-Hub 数据" : "Pisces-Hub 中暂无 NetCDF" }}</option>
    <template v-for="asset in assets" :key="asset.id">
      <option
        v-for="member in asset.kind === 'series' ? asset.files.map(item => item.filename) : [null]"
        :key="`${asset.id}:${member || ''}`"
        :value="optionValue(asset, member)"
      >
        {{ asset.kind === "series"
          ? `推理 ${asset.name} / ${member}`
          : `${asset.source === "simulator" ? "模拟" : "数据"} / ${asset.name}` }}
      </option>
    </template>
  </select>
</template>
