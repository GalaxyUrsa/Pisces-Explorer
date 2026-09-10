<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from "vue";
import { apiFetch, errorMessage, parseHubReference } from "../shared/api";
import type { SimulatorForm } from "./types";

const props = defineProps<{
  form: SimulatorForm;
  localFile: File | null;
}>();
const emit = defineEmits<{ center: [longitude: number, latitude: number] }>();

const EARTH_RADIUS_KM = 6371.0088;
const OVERLAY_POINTS = 96;
const graph = ref<HTMLElement | null>(null);
const graphReady = ref(false);
const loading = ref(false);
const status = ref("请选择背景场并加载地图。");
const statusType = ref("");
let ranges: { lon: number[]; lat: number[] } | null = null;

function setStatus(message: string, type = ""): void {
  status.value = message;
  statusType.value = type;
}

function centerInside(longitude: number, latitude: number): boolean {
  return Boolean(
    ranges
    && longitude >= ranges.lon[0] && longitude <= ranges.lon[1]
    && latitude >= ranges.lat[0] && latitude <= ranges.lat[1]
  );
}

function radiusBoundary(longitude: number, latitude: number, radiusKm: number) {
  const angular = radiusKm / EARTH_RADIUS_KM;
  const lat = latitude * Math.PI / 180;
  const lon = longitude * Math.PI / 180;
  const x: number[] = [];
  const y: number[] = [];
  for (let index = 0; index <= OVERLAY_POINTS; index += 1) {
    const bearing = 2 * Math.PI * index / OVERLAY_POINTS;
    const pointLat = Math.asin(
      Math.sin(lat) * Math.cos(angular)
      + Math.cos(lat) * Math.sin(angular) * Math.cos(bearing),
    );
    const pointLon = lon + Math.atan2(
      Math.sin(bearing) * Math.sin(angular) * Math.cos(lat),
      Math.cos(angular) - Math.sin(lat) * Math.sin(pointLat),
    );
    let degrees = pointLon * 180 / Math.PI;
    while (degrees - longitude > 180) degrees -= 360;
    while (degrees - longitude < -180) degrees += 360;
    x.push(degrees);
    y.push(pointLat * 180 / Math.PI);
  }
  return { x, y };
}

async function updateOverlay(): Promise<void> {
  if (!graphReady.value || !graph.value) return;
  const { longitude, latitude, radiusKm } = props.form;
  if (
    !Number.isFinite(longitude) || !Number.isFinite(latitude)
    || !Number.isFinite(radiusKm) || radiusKm <= 0
    || !centerInside(longitude, latitude)
  ) {
    await Plotly.restyle(graph.value, { x: [[]], y: [[]] }, [1, 2]);
    setStatus("当前涡心超出背景场范围，请在地图内点击或修改经纬度。", "error");
    return;
  }
  const boundary = radiusBoundary(longitude, latitude, radiusKm);
  await Plotly.restyle(graph.value, { x: [boundary.x], y: [boundary.y] }, [1]);
  await Plotly.restyle(graph.value, { x: [[longitude]], y: [[latitude]] }, [2]);
  setStatus("地图已就绪；点击有效海洋区域可重新设置涡心。", "success");
}

function previewFormData(): FormData {
  const data = new FormData();
  if (props.form.inputSource === "hub") {
    const reference = parseHubReference(props.form.hubInput);
    if (!reference) throw new Error("请选择 Pisces-Hub 背景场。");
    data.append("hub_asset_id", reference.id);
    if (reference.member) data.append("hub_member", reference.member);
  } else {
    if (!props.localFile) throw new Error("请选择本地背景场 NetCDF。");
    data.append("file", props.localFile);
  }
  return data;
}

async function loadPreview(): Promise<void> {
  loading.value = true;
  setStatus("正在读取表层流速并构建背景场地图…", "loading");
  try {
    const response = await apiFetch<any>("/api/simulator/preview", {
      method: "POST",
      body: previewFormData(),
    });
    ranges = { lon: response.lon_range, lat: response.lat_range };
    const figure = response.figure;
    figure.data.push(
      {
        type: "scatter", mode: "lines", x: [], y: [], fill: "toself",
        fillcolor: "rgba(37, 99, 235, 0.13)",
        line: { color: "#2563eb", width: 2 },
        hoverinfo: "skip", showlegend: false,
      },
      {
        type: "scatter", mode: "markers", x: [], y: [],
        marker: { size: 12, color: "#ef4444", line: { color: "#fff", width: 2 } },
        hovertemplate: "涡心<br>%{x:.3f}°, %{y:.3f}°<extra></extra>",
        showlegend: false,
      },
    );
    if (!graph.value) return;
    await Plotly.react(graph.value, figure.data, figure.layout, {
      responsive: true,
      displaylogo: false,
      scrollZoom: true,
    });
    graphReady.value = true;
    const plot = graph.value as any;
    plot.removeAllListeners?.("plotly_click");
    plot.on("plotly_click", async (event: any) => {
      const point = event?.points?.[0];
      if (!point || point.curveNumber !== 0) return;
      emit("center", Number(point.x), Number(point.y));
      await nextTick();
      await updateOverlay();
    });
    if (!centerInside(props.form.longitude, props.form.latitude)) {
      emit(
        "center",
        (ranges.lon[0] + ranges.lon[1]) / 2,
        (ranges.lat[0] + ranges.lat[1]) / 2,
      );
      await nextTick();
    }
    await updateOverlay();
  } catch (error) {
    setStatus(`背景场加载失败：${errorMessage(error)}`, "error");
  } finally {
    loading.value = false;
  }
}

function clearPreview(): void {
  ranges = null;
  graphReady.value = false;
  if (graph.value) {
    Plotly.purge(graph.value);
    graph.value.replaceChildren();
  }
  setStatus("背景场已更改，请重新加载地图。", "");
}

watch(
  () => [props.form.longitude, props.form.latitude, props.form.radiusKm],
  () => { updateOverlay(); },
);
watch(
  () => [props.form.inputSource, props.form.hubInput, props.localFile],
  (_current, previous) => { if (previous) clearPreview(); },
);
onBeforeUnmount(() => { if (graph.value) Plotly.purge(graph.value); });

defineExpose({ loadPreview, clearPreview });
</script>

<template>
  <section class="simulator-preview-section" aria-labelledby="simulator-preview-title">
    <div class="simulator-preview-heading">
      <div>
        <h3 id="simulator-preview-title">背景场地图选点</h3>
        <p>加载表层流速后，在有效海洋区域点击设置涡心；圆形范围随半径实时更新。</p>
      </div>
      <button id="simulator-preview-load" class="workflow-secondary-btn" type="button" :disabled="loading" @click="loadPreview">
        {{ loading ? "正在加载…" : "加载背景场地图" }}
      </button>
    </div>
    <div class="workflow-status" :class="statusType" aria-live="polite">{{ status }}</div>
    <div class="simulator-preview-layout">
      <div id="simulator-preview-map" ref="graph" class="simulator-preview-map"><span>背景场地图将在这里显示</span></div>
      <aside class="simulator-preview-summary" aria-label="当前模拟参数">
        <h4>当前涡旋配置</h4>
        <dl>
          <div><dt>中心</dt><dd>{{ form.longitude.toFixed(4) }}°E, {{ form.latitude.toFixed(4) }}°N</dd></div>
          <div><dt>半径</dt><dd>{{ form.radiusKm }} km</dd></div>
          <div><dt>SSH 振幅</dt><dd>{{ form.amplitudeCm }} cm</dd></div>
          <div><dt>影响深度</dt><dd>{{ form.influenceDepthM }} m</dd></div>
        </dl>
      </aside>
    </div>
  </section>
</template>
