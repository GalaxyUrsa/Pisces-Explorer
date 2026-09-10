<script setup lang="ts">
import type { StatusType } from "../shared/types";

defineProps<{ message: string; type?: StatusType }>();
</script>

<template>
  <div
    v-if="message"
    class="workflow-status"
    :class="type"
    aria-live="polite"
  >{{ message }}</div>
</template>
