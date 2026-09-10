import { computed, reactive, ref } from "vue";
import { apiFetch, errorMessage } from "./api";
import { loadRecord, saveRecord } from "./storage";
import type {
  HubAsset, TaskState, WorkflowKind, WorkflowStatus,
} from "./types";

export function useWorkflow(kind: WorkflowKind) {
  const record = reactive(loadRecord(kind));
  const assets = ref<HubAsset[]>([]);
  const historyLoading = ref(false);
  const historyError = ref("");
  const status = reactive<WorkflowStatus>({ message: "", type: "" });
  const history = computed(() => assets.value.filter(asset => asset.source === kind));
  const netcdfAssets = computed(() => (
    assets.value.filter(asset => asset.asset_type === "netcdf")
  ));
  const modelAssets = computed(() => (
    assets.value.filter(asset => asset.asset_type === "model")
  ));

  function persist(): void {
    saveRecord(kind, record);
  }

  function setStatus(message: string, type: WorkflowStatus["type"] = ""): void {
    status.message = message;
    status.type = type;
  }

  function setTask(task: TaskState): void {
    record.task = task;
    persist();
  }

  async function refreshAssets(): Promise<void> {
    historyLoading.value = true;
    historyError.value = "";
    try {
      const response = await apiFetch<{ assets: HubAsset[] }>("/api/hub/assets");
      assets.value = response.assets;
    } catch (error) {
      historyError.value = `历史记录读取失败：${errorMessage(error)}`;
    } finally {
      historyLoading.value = false;
    }
  }

  async function loadAsset(asset: HubAsset): Promise<void> {
    setStatus("正在载入历史结果…", "loading");
    try {
      await apiFetch(`/api/hub/assets/${encodeURIComponent(asset.id)}/load`, {
        method: "POST",
      });
      window.location.href = "/";
    } catch (error) {
      setStatus(`载入失败：${errorMessage(error)}`, "error");
    }
  }

  async function removeAsset(asset: HubAsset): Promise<void> {
    if (!window.confirm(`确定删除“${asset.name}”吗？此操作不可恢复。`)) return;
    try {
      await apiFetch(`/api/hub/assets/${encodeURIComponent(asset.id)}`, {
        method: "DELETE",
      });
      const result = record.task.result;
      if (result && (result.filename === asset.name || result.run_id === asset.name)) {
        setTask({ status: "idle" });
      }
      setStatus("历史记录已从 Pisces-Hub 删除。", "success");
      await refreshAssets();
    } catch (error) {
      setStatus(`删除失败：${errorMessage(error)}`, "error");
    }
  }

  async function recoverRunningTask(): Promise<void> {
    if (record.task.status !== "running") return;
    const endpoint = kind === "simulator"
      ? "/api/simulator/results/latest"
      : "/api/inference/results/latest";
    try {
      const latest = await apiFetch<any>(endpoint);
      if (
        latest.ok
        && latest.completed_at_ms >= (record.task.started_at_ms || 0)
      ) {
        setTask({ status: "success", result: latest });
        return;
      }
    } catch {
      // Preserve the running state when the backend cannot be reached.
    }
    setStatus(
      "任务尚未发现完成结果；如果仍在执行，稍后重新打开页面即可恢复。",
      "loading",
    );
  }

  return {
    record,
    assets,
    history,
    netcdfAssets,
    modelAssets,
    historyLoading,
    historyError,
    status,
    persist,
    setStatus,
    setTask,
    refreshAssets,
    loadAsset,
    removeAsset,
    recoverRunningTask,
  };
}
