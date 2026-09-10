<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from "vue";

export type RegionSelection = {
  mode: "center" | "bounds";
  center: { lon: number; lat: number };
  bounds: number[];
  width_km: number;
  height_km: number;
  fixed_size: boolean;
};

const emit = defineEmits<{ confirmed: [selection: RegionSelection] }>();
const mode = ref<"center" | "bounds">("center");
const form = reactive({
  lon: 135, lat: 20, lonMin: 133.85, lonMax: 136.15,
  latMin: 18.92, latMax: 21.08,
});
const graph = ref<HTMLElement | null>(null);
const error = ref("");
const saving = ref(false);
const view = reactive({ lon: 135, lat: 20, lonSpan: 80, latSpan: 60 });
let pointerStart: { x: number; y: number } | null = null;

function projectedCoordinate(clientX: number, clientY: number): [number, number] | null {
  if (!graph.value) return null;
  const rectangle = graph.value.getBoundingClientRect();
  const plot = graph.value as HTMLElement & {
    _fullLayout?: {
      geo?: { _subplot?: { projection?: { invert?: (point: [number, number]) => [number, number] | null } } };
    };
  };
  const invert = plot._fullLayout?.geo?._subplot?.projection?.invert;
  if (!invert) return null;
  const coordinate = invert([clientX - rectangle.left, clientY - rectangle.top]);
  if (!coordinate || coordinate.some(value => !Number.isFinite(value))) return null;
  const [lon, lat] = coordinate;
  if (lon < -180 || lon > 180 || lat < -90 || lat > 90) return null;
  return [lon, lat];
}

const preview = computed(() => {
  if (mode.value === "bounds") {
    return [form.lonMin, form.lonMax, form.latMin, form.latMax];
  }
  const latDelta = (120 / 6371.0088) * 180 / Math.PI;
  const lonDelta = latDelta / Math.cos(form.lat * Math.PI / 180);
  return [form.lon - lonDelta, form.lon + lonDelta, form.lat - latDelta, form.lat + latDelta];
});

const size = computed(() => {
  const [lonMin, lonMax, latMin, latMax] = preview.value;
  const centerLat = (latMin + latMax) / 2 * Math.PI / 180;
  return {
    width: Math.abs(6371.0088 * Math.cos(centerLat) * (lonMax - lonMin) * Math.PI / 180),
    height: Math.abs(6371.0088 * (latMax - latMin) * Math.PI / 180),
  };
});

async function draw(): Promise<void> {
  if (!graph.value || preview.value.some(value => !Number.isFinite(value))) return;
  const [lonMin, lonMax, latMin, latMax] = preview.value;
  await Plotly.react(graph.value, [{
    type: "scattergeo", mode: "lines",
    lon: [lonMin, lonMax, lonMax, lonMin, lonMin],
    lat: [latMin, latMin, latMax, latMax, latMin],
    fill: "toself", fillcolor: "rgba(37,99,235,.16)",
    line: { color: "#2563eb", width: 2 }, hoverinfo: "skip",
  }, {
    type: "scattergeo", mode: "markers",
    lon: [(lonMin + lonMax) / 2], lat: [(latMin + latMax) / 2],
    marker: { color: "#ef4444", size: 8 },
  }], {
    margin: { l: 0, r: 0, t: 0, b: 0 },
    geo: {
      projection: { type: "equirectangular" },
      showland: true, landcolor: "#e2e8f0",
      showocean: true, oceancolor: "#eff6ff",
      showcountries: true, countrycolor: "#cbd5e1",
      coastlinecolor: "#94a3b8",
      lonaxis: {
        range: [view.lon - view.lonSpan / 2, view.lon + view.lonSpan / 2],
        showgrid: true, gridcolor: "#dbe4f0",
      },
      lataxis: {
        range: [view.lat - view.latSpan / 2, view.lat + view.latSpan / 2],
        showgrid: true, gridcolor: "#dbe4f0",
      },
    },
    paper_bgcolor: "#fff", dragmode: false, uirevision: "region-picker",
  }, { responsive: true, displaylogo: false, scrollZoom: false });
}

function attachClick(): void {
  graph.value?.addEventListener("pointerdown", event => {
    pointerStart = { x: event.clientX, y: event.clientY };
  });
  graph.value?.addEventListener("pointerup", event => {
    if (!pointerStart || !graph.value) return;
    const dx = event.clientX - pointerStart.x;
    const dy = event.clientY - pointerStart.y;
    if (Math.hypot(dx, dy) <= 5) return;
    const start = projectedCoordinate(pointerStart.x, pointerStart.y);
    const end = projectedCoordinate(event.clientX, event.clientY);
    if (!start || !end) return;
    view.lon = Math.max(
      -180 + view.lonSpan / 2,
      Math.min(180 - view.lonSpan / 2, view.lon + start[0] - end[0]),
    );
    view.lat = Math.max(
      -90 + view.latSpan / 2,
      Math.min(90 - view.latSpan / 2, view.lat + start[1] - end[1]),
    );
    void draw();
  });
  graph.value?.addEventListener("click", event => {
    if (mode.value !== "center" || !graph.value) return;
    if (
      pointerStart
      && Math.hypot(
        event.clientX - pointerStart.x,
        event.clientY - pointerStart.y,
      ) > 5
    ) return;
    const coordinate = projectedCoordinate(event.clientX, event.clientY);
    if (!coordinate) return;
    const [lon, lat] = coordinate;
    form.lon = Number(lon.toFixed(4));
    form.lat = Number(lat.toFixed(4));
  });
}

function zoom(factor: number): void {
  view.lonSpan = Math.max(4, Math.min(360, view.lonSpan * factor));
  view.latSpan = Math.max(3, Math.min(160, view.latSpan * factor));
  void draw();
}

function focusSelection(): void {
  const bounds = preview.value;
  view.lon = (bounds[0] + bounds[1]) / 2;
  view.lat = (bounds[2] + bounds[3]) / 2;
  view.lonSpan = Math.max(8, Math.min(360, (bounds[1] - bounds[0]) * 5));
  view.latSpan = Math.max(6, Math.min(160, (bounds[3] - bounds[2]) * 5));
  view.lon = Math.max(
    -180 + view.lonSpan / 2,
    Math.min(180 - view.lonSpan / 2, view.lon),
  );
  view.lat = Math.max(
    -90 + view.latSpan / 2,
    Math.min(90 - view.latSpan / 2, view.lat),
  );
  void draw();
}

function resetView(): void {
  Object.assign(view, { lon: 135, lat: 20, lonSpan: 80, latSpan: 60 });
  void draw();
}

async function confirmSelection(): Promise<void> {
  error.value = "";
  const payload = mode.value === "center"
    ? { mode: "center", lon: form.lon, lat: form.lat }
    : { mode: "bounds", bounds: [form.lonMin, form.lonMax, form.latMin, form.latMax] };
  saving.value = true;
  try {
    const response = await fetch("/region/api/selection", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.detail || "区域设置失败");
    emit("confirmed", data.selection);
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : String(cause);
  } finally {
    saving.value = false;
  }
}

watch([mode, () => form.lon, () => form.lat, () => form.lonMin, () => form.lonMax, () => form.latMin, () => form.latMax], () => { void draw(); });
onMounted(async () => { await nextTick(); await draw(); attachClick(); });
onBeforeUnmount(() => { if (graph.value) Plotly.purge(graph.value); });
</script>

<template>
  <main class="region-setup-page">
    <section class="region-setup-card">
      <div class="region-setup-form">
        <span class="workflow-eyebrow">Pisces-Region</span>
        <h1>确定研究区域</h1>
        <p>数据加载和后续分析只保留这个区域。</p>
        <div class="region-mode-tabs">
          <button type="button" :class="{ active: mode === 'center' }" @click="mode = 'center'">中心点 · 240×240 km</button>
          <button type="button" :class="{ active: mode === 'bounds' }" @click="mode = 'bounds'">指定四边界</button>
        </div>
        <div v-if="mode === 'center'" class="region-coordinate-grid">
          <label>中心经度<input v-model.number="form.lon" type="number" min="-180" max="180" step="0.01"></label>
          <label>中心纬度<input v-model.number="form.lat" type="number" min="-88" max="88" step="0.01"></label>
          <p>也可以直接点击地图选择中心点。</p>
        </div>
        <div v-else class="region-coordinate-grid bounds">
          <label>最小经度<input v-model.number="form.lonMin" type="number" min="-180" max="180" step="0.01"></label>
          <label>最大经度<input v-model.number="form.lonMax" type="number" min="-180" max="180" step="0.01"></label>
          <label>最小纬度<input v-model.number="form.latMin" type="number" min="-90" max="90" step="0.01"></label>
          <label>最大纬度<input v-model.number="form.latMax" type="number" min="-90" max="90" step="0.01"></label>
        </div>
        <div class="region-preview-summary">
          <strong>{{ size.width.toFixed(0) }} × {{ size.height.toFixed(0) }} km</strong>
          <span>{{ preview[0].toFixed(3) }}°E – {{ preview[1].toFixed(3) }}°E</span>
          <span>{{ preview[2].toFixed(3) }}°N – {{ preview[3].toFixed(3) }}°N</span>
        </div>
        <p v-if="error" class="workflow-status error">{{ error }}</p>
        <button class="workflow-primary-btn" type="button" :disabled="saving" @click="confirmSelection">
          {{ saving ? "正在确认…" : "确认区域并选择数据" }}
        </button>
      </div>
      <div class="region-picker-wrap">
        <div ref="graph" class="region-picker-map" aria-label="研究区域地图"></div>
        <div class="region-map-toolbar">
          <button type="button" title="放大" @click="zoom(0.55)">＋</button>
          <button type="button" title="缩小" @click="zoom(1.8)">−</button>
          <button type="button" @click="focusSelection">定位选区</button>
          <button type="button" @click="resetView">西太平洋</button>
        </div>
        <span class="region-map-hint">{{ mode === "center" ? "点击设置中心点 · 拖动平移 · 放大后可精确选择" : "四边界模式请在左侧输入范围" }}</span>
      </div>
    </section>
  </main>
</template>
