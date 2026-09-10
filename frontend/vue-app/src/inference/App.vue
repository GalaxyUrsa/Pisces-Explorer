<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from "vue";
import AppHeader from "../components/AppHeader.vue";
import HistoryList from "../components/HistoryList.vue";
import HubNetcdfSelect from "../components/HubNetcdfSelect.vue";
import WorkflowStatus from "../components/WorkflowStatus.vue";
import { apiFetch, errorMessage, parseHubReference } from "../shared/api";
import { useWorkflow } from "../shared/useWorkflow";

const workflow = useWorkflow("inference");
const inputFile = ref<File | null>(null);
const weightsFile = ref<File | null>(null);
const running = ref(false);
const progress = ref(0);
const progressStage = ref("");
let polling = true;

function saved<T>(id: string, fallback: T): T {
  return (workflow.record.form[id] as T | undefined) ?? fallback;
}

const form = reactive({
  model: saved("inference-model", "pisces_ocean_v5_ar"),
  inputSource: saved("inference-input-source", "local") as "local" | "hub",
  hubInput: saved("inference-hub-input", ""),
  weightsSource: saved("inference-weights-source", "local") as "local" | "hub",
  hubWeights: saved("inference-hub-weights", ""),
  steps: Number(saved("inference-steps", 5)),
  device: saved("inference-device", "cuda") as "cuda" | "cpu",
  startDate: saved("inference-start-date", ""),
  amp: Boolean(saved("inference-amp", false)),
});

const result = computed(() => (
  workflow.record.task.status === "success" ? workflow.record.task.result : null
));
const resultDates = computed(() => (
  Array.isArray(result.value?.dates) ? result.value.dates : []
));

function persistForm(): void {
  Object.assign(workflow.record.form, {
    "inference-model": form.model,
    "inference-input-source": form.inputSource,
    "inference-hub-input": form.hubInput,
    "inference-weights-source": form.weightsSource,
    "inference-hub-weights": form.hubWeights,
    "inference-steps": String(form.steps),
    "inference-device": form.device,
    "inference-start-date": form.startDate,
    "inference-amp": form.amp,
  });
  workflow.persist();
}

watch(form, persistForm, { deep: true });

function chooseInput(event: Event): void {
  inputFile.value = (event.target as HTMLInputElement).files?.[0] || null;
  if (inputFile.value) workflow.record.files.input = inputFile.value.name;
  workflow.persist();
}

function chooseWeights(event: Event): void {
  weightsFile.value = (event.target as HTMLInputElement).files?.[0] || null;
  if (weightsFile.value) workflow.record.files.weights = weightsFile.value.name;
  workflow.persist();
}

function buildFormData(): FormData {
  const data = new FormData();
  if (form.inputSource === "hub") {
    const reference = parseHubReference(form.hubInput);
    if (!reference) throw new Error("请选择 Pisces-Hub 初始场。");
    data.append("input_hub_asset_id", reference.id);
    if (reference.member) data.append("input_hub_member", reference.member);
  } else {
    if (!inputFile.value) throw new Error("请选择初始场 NetCDF。");
    data.append("input_nc", inputFile.value);
  }
  if (form.weightsSource === "hub") {
    const reference = parseHubReference(form.hubWeights);
    if (!reference) throw new Error("请选择 Pisces-Hub 模型权重。");
    data.append("weights_hub_asset_id", reference.id);
  } else {
    if (!weightsFile.value) throw new Error("请选择模型权重。");
    data.append("weights", weightsFile.value);
  }
  data.append("model", form.model);
  data.append("steps", String(form.steps));
  data.append("device", form.device);
  data.append("start_date", form.startDate);
  data.append("amp", String(form.amp));
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
  progress.value = 0;
  progressStage.value = "正在提交任务";
  workflow.setStatus("正在提交模型推理任务…", "loading");
  try {
    const task = await apiFetch<any>("/api/inference/tasks", {
      method: "POST",
      body: data,
    });
    workflow.setTask({
      status: "running",
      started_at_ms: Date.now(),
      task_id: task.task_id,
      progress: task.progress,
      stage: task.stage,
    });
    await monitorTask(task.task_id);
  } catch (error) {
    const message = `推理失败：${errorMessage(error)}`;
    workflow.setTask({ status: "error", message });
    workflow.setStatus(message, "error");
  } finally {
    running.value = false;
  }
}

function delay(milliseconds: number): Promise<void> {
  return new Promise(resolve => window.setTimeout(resolve, milliseconds));
}

async function monitorTask(taskId: string): Promise<void> {
  running.value = true;
  while (polling) {
    const task = await apiFetch<any>(
      `/api/inference/tasks/${encodeURIComponent(taskId)}`,
    );
    progress.value = Number(task.progress || 0);
    progressStage.value = task.stage || "正在推理";
    workflow.setStatus(progressStage.value, "loading");
    workflow.setTask({
      status: "running",
      started_at_ms: workflow.record.task.started_at_ms,
      task_id: taskId,
      progress: progress.value,
      stage: progressStage.value,
    });
    if (task.status === "success") {
      progress.value = 100;
      workflow.setTask({ status: "success", result: task.result });
      workflow.setStatus("推理完成，预测序列已保存到 Pisces-Hub。", "success");
      await workflow.refreshAssets();
      running.value = false;
      return;
    }
    if (task.status === "error") {
      throw new Error(task.error || "推理任务失败");
    }
    await delay(700);
  }
}

async function loadCurrentResult(): Promise<void> {
  if (!result.value?.run_id) return;
  workflow.setStatus("正在将预测序列载入 Explorer…", "loading");
  try {
    await apiFetch(
      `/api/inference/results/${encodeURIComponent(result.value.run_id)}/load`,
      { method: "POST" },
    );
    window.location.href = "/";
  } catch (error) {
    workflow.setStatus(`载入失败：${errorMessage(error)}`, "error");
  }
}

onMounted(async () => {
  if (workflow.record.task.status === "success") {
    workflow.setStatus("已恢复上次完成的推理结果。", "success");
  } else if (workflow.record.task.status === "error") {
    workflow.setStatus(workflow.record.task.message || "推理失败。", "error");
  }
  await workflow.refreshAssets();
  if (
    workflow.record.task.status === "running"
    && workflow.record.task.task_id
  ) {
    progress.value = Number(workflow.record.task.progress || 0);
    progressStage.value = workflow.record.task.stage || "正在恢复推理进度";
    try {
      await monitorTask(workflow.record.task.task_id);
    } catch (error) {
      const message = `推理状态读取失败：${errorMessage(error)}`;
      workflow.setTask({ status: "error", message });
      workflow.setStatus(message, "error");
      running.value = false;
    }
  } else {
    await workflow.recoverRunningTask();
  }
  if (workflow.record.task.status === "success") {
    workflow.setStatus("推理结果已保存在 Pisces-Hub。", "success");
  }
});

onBeforeUnmount(() => { polling = false });
</script>

<template>
  <AppHeader active="inference" />
  <main class="workflow-page">
    <section class="workflow-hero inference-hero">
      <div>
        <div class="workflow-eyebrow">Pisces-Ocean-Infer</div>
        <h1>海洋模型推理</h1>
        <p>选择模型与权重，从一个 NetCDF 初始场滚动生成多日海洋预测结果。</p>
      </div>
      <div class="workflow-hero-badge">Inference Runtime</div>
    </section>

    <section class="workflow-panel">
      <div class="workflow-panel-heading">
        <div><h2>自回归多日预测</h2><p>当前提供已验证兼容的 Pisces-Ocean v5 AR 模型。</p></div>
        <span class="workflow-step">01 · 配置任务</span>
      </div>
      <div class="workflow-form">
        <label class="workflow-field workflow-field-wide"><span>模型</span>
          <select id="inference-model" v-model="form.model"><option value="pisces_ocean_v5_ar">Pisces-Ocean v5 AR</option></select>
        </label>
        <label class="workflow-field workflow-field-wide"><span>初始场来源</span>
          <select id="inference-input-source" v-model="form.inputSource"><option value="local">本地上传</option><option value="hub">从 Pisces-Hub 选择</option></select>
        </label>
        <label v-if="form.inputSource === 'local'" class="workflow-file-picker workflow-field-wide"><span>初始场 NetCDF</span>
          <input id="inference-input" type="file" accept=".nc" @change="chooseInput" />
          <small>需包含单个时刻的 thetao、so、uo、vo。</small>
          <small v-if="workflow.record.files.input" class="workflow-file-memory">上次选择：{{ workflow.record.files.input }}（重新运行时需再次选择）</small>
        </label>
        <label v-else class="workflow-field workflow-field-wide"><span>Pisces-Hub 初始场</span>
          <HubNetcdfSelect id="inference-hub-input" v-model="form.hubInput" :assets="workflow.netcdfAssets.value" />
          <small>推理历史序列可选择其中一帧继续滚动预测。</small>
        </label>
        <label class="workflow-field workflow-field-wide"><span>权重来源</span>
          <select id="inference-weights-source" v-model="form.weightsSource"><option value="local">本地上传</option><option value="hub">从 Pisces-Hub 选择</option></select>
        </label>
        <label v-if="form.weightsSource === 'local'" class="workflow-file-picker workflow-field-wide"><span>模型权重</span>
          <input id="inference-weights" type="file" accept=".pth,.pt,.ckpt" @change="chooseWeights" />
          <small>选择与 Pisces-Ocean v5 AR 结构兼容的 checkpoint。</small>
          <small v-if="workflow.record.files.weights" class="workflow-file-memory">上次选择：{{ workflow.record.files.weights }}（重新运行时需再次选择）</small>
        </label>
        <label v-else class="workflow-field workflow-field-wide"><span>Pisces-Hub 模型权重</span>
          <select id="inference-hub-weights" v-model="form.hubWeights">
            <option value="">{{ workflow.modelAssets.value.length ? "请选择 Pisces-Hub 权重" : "Pisces-Hub 中暂无模型权重" }}</option>
            <option v-for="asset in workflow.modelAssets.value" :key="asset.id" :value="JSON.stringify({ id: asset.id })">{{ asset.name }}</option>
          </select>
        </label>
        <label class="workflow-field"><span>预测天数</span><input id="inference-steps" v-model.number="form.steps" type="number" min="1" max="20" /></label>
        <label class="workflow-field"><span>计算设备</span><select id="inference-device" v-model="form.device"><option value="cuda">CUDA</option><option value="cpu">CPU</option></select></label>
        <label class="workflow-field"><span>起始日期</span><input id="inference-start-date" v-model="form.startDate" type="text" inputmode="numeric" maxlength="8" placeholder="YYYYMMDD（可选）" /></label>
        <label class="workflow-checkbox"><input id="inference-amp" v-model="form.amp" type="checkbox" /> CUDA 混合精度</label>
      </div>

      <div class="workflow-actions">
        <button id="run-inference-btn" class="workflow-primary-btn" :disabled="running" @click="run">{{ running ? "正在推理…" : "运行模型推理" }}</button>
        <button v-if="result" id="inference-view-result" class="workflow-secondary-btn" @click="loadCurrentResult">在 Explorer 中查看</button>
      </div>
      <div v-if="running" class="inference-progress" role="status" aria-live="polite">
        <div class="inference-progress-copy">
          <span>{{ progressStage || "正在推理" }}</span>
          <strong>{{ progress }}%</strong>
        </div>
        <div
          class="inference-progress-track"
          role="progressbar"
          aria-label="模型推理进度"
          aria-valuemin="0"
          aria-valuemax="100"
          :aria-valuenow="progress"
        >
          <div class="inference-progress-fill" :style="{ width: `${progress}%` }"></div>
        </div>
      </div>
      <WorkflowStatus :message="workflow.status.message" :type="workflow.status.type" />
      <div v-if="result" id="inference-result" class="workflow-result">
        <strong>{{ result.model }}</strong>
        <span>{{ resultDates.length }} 天 · {{ resultDates[0] }} → {{ resultDates[resultDates.length - 1] }}</span>
        <small>权重：{{ result.weights || workflow.record.files.weights || "未知" }}</small>
      </div>
      <div v-if="result?.results?.length" id="inference-downloads" class="workflow-downloads">
        <a v-for="item in result.results" :key="item.filename" class="workflow-download-link" :href="item.download_url" :download="item.filename">下载 {{ item.filename }}</a>
      </div>
    </section>

    <section class="workflow-panel workflow-history-panel">
      <div class="workflow-panel-heading">
        <div><h2>推理历史记录</h2><p>Pisces-Hub 中按任务保存的预测序列，可重新载入 Explorer 或删除。</p></div>
        <button class="workflow-compact-btn" @click="workflow.refreshAssets">刷新</button>
      </div>
      <HistoryList
        id="inference-history"
        kind="inference"
        :assets="workflow.history.value"
        :loading="workflow.historyLoading.value"
        :error="workflow.historyError.value"
        @load="workflow.loadAsset"
        @remove="workflow.removeAsset"
      />
    </section>
  </main>
</template>
