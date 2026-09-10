import type { WorkflowKind, WorkflowRecord } from "./types";

const STORAGE_KEYS: Record<WorkflowKind, string> = {
  simulator: "pisces.workflow.simulator.v1",
  inference: "pisces.workflow.inference.v1",
};

export function emptyRecord(): WorkflowRecord {
  return { form: {}, files: {}, task: { status: "idle" } };
}

export function loadRecord(kind: WorkflowKind): WorkflowRecord {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEYS[kind]) || "{}");
    return {
      ...emptyRecord(),
      ...saved,
      form: { ...(saved.form || {}) },
      files: { ...(saved.files || {}) },
      task: { status: "idle", ...(saved.task || {}) },
    };
  } catch {
    return emptyRecord();
  }
}

export function saveRecord(kind: WorkflowKind, record: WorkflowRecord): void {
  localStorage.setItem(STORAGE_KEYS[kind], JSON.stringify(record));
}
