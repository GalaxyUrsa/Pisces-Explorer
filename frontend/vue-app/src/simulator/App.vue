<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from "vue";
import AppHeader from "../components/AppHeader.vue";
import HistoryList from "../components/HistoryList.vue";
import HubNetcdfSelect from "../components/HubNetcdfSelect.vue";
import WorkflowStatus from "../components/WorkflowStatus.vue";
import { apiFetch, errorMessage, parseHubReference } from "../shared/api";
import { useWorkflow } from "../shared/useWorkflow";
import SimulatorMap from "./SimulatorMap.vue";
import type { SimulatorForm } from "./types";

const workflow = useWorkflow("simulator");
const localFile = ref<File | null>(null);
const running = ref(false);

function saved<T>(id: string, fallback: T): T {
  return (workflow.record.form[id] as T | undefined) ?? fallback;
}

const form = reactive<SimulatorForm>({
  phenomenon: saved("simulator-phenomenon", "eddy"),
  inputSource: saved("simulator-input-source", "local") as "local" | "hub",
  hubInput: saved("simulator-hub-input", ""),
  longitude: Number(saved("simulator-lon", 135)),
  latitude: Number(saved("simulator-lat", 30)),
  radiusKm: Number(saved("simulator-radius", 75)),
  amplitudeCm: Number(saved("simulator-amplitude", 10)),
  influenceDepthM: Number(saved("simulator-depth", 700)),
});

const result = computed(() => (
  workflow.record.task.status === "success" ? workflow.record.task.result : null
));

function persistForm(): void {
  Object.assign(workflow.record.form, {
    "simulator-phenomenon": form.phenomenon,
    "simulator-input-source": form.inputSource,
    "simulator-hub-input": form.hubInput,
    "simulator-lon": String(form.longitude),
    "simulator-lat": String(form.latitude),
    "simulator-radius": String(form.radiusKm),
    "simulator-amplitude": String(form.amplitudeCm),
    "simulator-depth": String(form.influenceDepthM),
  });
  workflow.persist();
}

watch(form, persistForm, { deep: true });

function chooseFile(event: Event): void {
  localFile.value = (event.target as HTMLInputElement).files?.[0] || null;
  if (localFile.value) workflow.record.files.input = localFile.value.name;
  workflow.persist();
}

function buildFormData(): FormData {
  const data = new FormData();
  if (form.inputSource === "hub") {
    const reference = parseHubReference(form.hubInput);
    if (!reference) throw new Error("请选择 Pisces-Hub 背景场 NetCDF。");
    data.append("hub_asset_id", reference.id);
    if (reference.member) data.append("hub_member", reference.member);
  } else {
    if (!localFile.value) throw new Error("请选择背景场 NetCDF。");
    data.append("file", localFile.value);
  }
  data.append("longitude", String(form.longitude));
  data.append("latitude", String(form.latitude));
  data.append("radius_km", String(form.radiusKm));
  data.append("amplitude_cm", String(form.amplitudeCm));
  data.append("influence_depth_m", String(form.influenceDepthM));
  return data;
}

async function run(): Promise<void> {
  let data: FormData;
  try {
    data = buildFormData();
  } catch (error) {
    workflow.setStatus(errorMessage(error), "error");
    return;
  }
  running.value = true;
  workflow.setTask({ status: "running", started_at_ms: Date.now() });
  workflow.setStatus("正在上传背景场并构造理想化涡旋…", "loading");
  try {
    const response = await apiFetch<any>("/api/simulator/eddy", {
      method: "POST",
      body: data,
    });
    workflow.setTask({ status: "success", result: response });
    workflow.setStatus("模拟完成，结果已保存到 Pisces-Hub。", "success");
    await workflow.refreshAssets();
  } catch (error) {
    const message = `模拟失败：${errorMessage(error)}`;
    workflow.setTask({ status: "error", message });
    workflow.setStatus(message, "error");
  } finally {
    running.value = false;
  }
}

async function loadCurrentResult(): Promise<void> {
  if (!result.value?.filename) return;
  workflow.setStatus("正在将保存结果载入 Explorer…", "loading");
  try {
    await apiFetch(
      `/api/simulator/results/${encodeURIComponent(result.value.filename)}/load`,
      { method: "POST" },
    );
    window.location.href = "/";
  } catch (error) {
    workflow.setStatus(`载入失败：${errorMessage(error)}`, "error");
  }
}

onMounted(async () => {
  if (workflow.record.task.status === "success") {
    workflow.setStatus("已恢复上次完成的模拟结果。", "success");
  } else if (workflow.record.task.status === "error") {
    workflow.setStatus(workflow.record.task.message || "模拟失败。", "error");
  }
  await Promise.all([workflow.refreshAssets(), workflow.recoverRunningTask()]);
  if (workflow.record.task.status === "success") {
    workflow.setStatus("模拟结果已保存在 Pisces-Hub。", "success");
  }
});
</script>

<template>
  <AppHeader active="simulator" />
  <main class="workflow-page">
    <section class="workflow-hero">
      <div>
        <div class="workflow-eyebrow">Pisces-Simulator</div>
        <h1>海洋现象模拟实验</h1>
        <p>在真实海洋背景场中构造可控的理想化过程，并将生成结果送入 Explorer 分析。</p>
      </div>
      <div class="workflow-hero-badge">Simulation Engine</div>
    </section>

    <section class="workflow-panel">
      <div class="workflow-panel-heading">
        <div><h2>理想化中尺度涡旋</h2><p>在流速场中嵌入满足地转平衡的三维涡旋。</p></div>
        <span class="workflow-step">01 · 配置场景</span>
      </div>
      <div class="workflow-form">
        <label class="workflow-field workflow-field-wide"><span>现象类型</span>
          <select id="simulator-phenomenon" v-model="form.phenomenon"><option value="eddy">理想化中尺度涡旋</option></select>
        </label>
        <label class="workflow-field workflow-field-wide"><span>背景场来源</span>
          <select id="simulator-input-source" v-model="form.inputSource"><option value="local">本地上传</option><option value="hub">从 Pisces-Hub 选择</option></select>
        </label>
        <label v-if="form.inputSource === 'local'" class="workflow-file-picker workflow-field-wide"><span>背景场 NetCDF</span>
          <input id="simulator-input" type="file" accept=".nc" @change="chooseFile" />
          <small>需包含 thetao、so、uo、vo 以及经纬度和深度坐标。</small>
          <small v-if="workflow.record.files.input" class="workflow-file-memory">上次选择：{{ workflow.record.files.input }}（重新运行时需再次选择）</small>
        </label>
        <label v-else class="workflow-field workflow-field-wide"><span>Pisces-Hub 历史数据</span>
          <HubNetcdfSelect id="simulator-hub-input" v-model="form.hubInput" :assets="workflow.netcdfAssets.value" />
          <small>推理序列可选择其中任意一帧作为背景场。</small>
        </label>
        <label class="workflow-field"><span>中心经度</span><input id="simulator-lon" v-model.number="form.longitude" type="number" step="0.1" /></label>
        <label class="workflow-field"><span>中心纬度</span><input id="simulator-lat" v-model.number="form.latitude" type="number" step="0.1" /></label>
        <label class="workflow-field"><span>半径 (km)</span><input id="simulator-radius" v-model.number="form.radiusKm" type="number" min="50" max="100" /></label>
        <label class="workflow-field"><span>SSH 振幅 (cm)</span><input id="simulator-amplitude" v-model.number="form.amplitudeCm" type="number" /></label>
        <label class="workflow-field"><span>垂向影响尺度 (m)</span><input id="simulator-depth" v-model.number="form.influenceDepthM" type="number" min="1" /></label>
      </div>

      <SimulatorMap
        :form="form"
        :local-file="localFile"
        @center="(lon, lat) => { form.longitude = lon; form.latitude = lat; }"
      />

      <div class="workflow-actions">
        <button id="run-simulator-btn" class="workflow-primary-btn" :disabled="running" @click="run">{{ running ? "正在生成…" : "生成模拟结果" }}</button>
        <button v-if="result" id="simulator-view-result" class="workflow-secondary-btn" @click="loadCurrentResult">在 Explorer 中查看</button>
        <a v-if="result" id="simulator-download-result" class="workflow-secondary-btn" :href="result.download_url" :download="result.filename">下载 NetCDF</a>
      </div>
      <WorkflowStatus :message="workflow.status.message" :type="workflow.status.type" />
      <div v-if="result" id="simulator-result" class="workflow-result"><strong>模拟结果</strong><span>{{ result.filename }}</span></div>
    </section>

    <section class="workflow-panel workflow-history-panel">
      <div class="workflow-panel-heading">
        <div><h2>模拟历史记录</h2><p>Pisces-Hub 中保存的模拟结果，可重新载入 Explorer 或删除。</p></div>
        <button class="workflow-compact-btn" @click="workflow.refreshAssets">刷新</button>
      </div>
      <HistoryList
        id="simulator-history"
        kind="simulator"
        :assets="workflow.history.value"
        :loading="workflow.historyLoading.value"
        :error="workflow.historyError.value"
        @load="workflow.loadAsset"
        @remove="workflow.removeAsset"
      />
    </section>
  </main>
</template>
