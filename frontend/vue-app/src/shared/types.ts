export type WorkflowKind = "simulator" | "inference";
export type StatusType = "" | "loading" | "success" | "error";

export interface TaskState {
  status: "idle" | "running" | "success" | "error";
  started_at_ms?: number;
  task_id?: string;
  progress?: number;
  stage?: string;
  message?: string;
  result?: any;
}

export interface WorkflowRecord {
  form: Record<string, string | number | boolean>;
  files: Record<string, string>;
  task: TaskState;
}

export interface HubFile {
  filename: string;
  download_url?: string;
}

export interface HubAsset {
  id: string;
  name: string;
  source: string;
  asset_type: "netcdf" | "model" | string;
  kind: "single" | "series" | string;
  files: HubFile[];
  size_bytes: number;
  created_at_ms: number;
  completed_at_ms?: number;
  parameters?: Record<string, any>;
  input?: { filename?: string };
  weights?: { filename?: string };
}

export interface HubReference {
  id: string;
  member?: string | null;
}

export interface WorkflowStatus {
  message: string;
  type: StatusType;
}
