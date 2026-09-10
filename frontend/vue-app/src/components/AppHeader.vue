<script setup lang="ts">
import { useSlots } from "vue";

defineProps<{ active: "explorer" | "region" | "simulator" | "inference" }>();
const slots = useSlots();
</script>

<template>
  <header class="app-header" :class="{ 'has-context': Boolean(slots.context) }">
    <a class="app-header-brand" href="/">Pisces-Explorer</a>
    <div v-if="slots.context" class="app-header-context">
      <slot name="context" />
    </div>
    <nav class="app-nav" aria-label="主导航">
      <a
        class="app-nav-link"
        :class="{ active: active === 'explorer' }"
        href="/"
        :aria-current="active === 'explorer' ? 'page' : undefined"
      >分析工作台</a>
      <a
        class="app-nav-link"
        :class="{ active: active === 'region' }"
        href="/region"
        :aria-current="active === 'region' ? 'page' : undefined"
      >区域分析</a>
      <a
        class="app-nav-link"
        :class="{ active: active === 'simulator' }"
        href="/simulator"
        :aria-current="active === 'simulator' ? 'page' : undefined"
      >模拟实验</a>
      <a
        class="app-nav-link"
        :class="{ active: active === 'inference' }"
        href="/inference"
        :aria-current="active === 'inference' ? 'page' : undefined"
      >模型推理</a>
    </nav>
  </header>
</template>
