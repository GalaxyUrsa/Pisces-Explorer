import type { HubAsset, WorkflowKind } from "./types";

export function formatBytes(size: number): string {
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export function historyParameters(kind: WorkflowKind, asset: HubAsset): string[] {
  const parameters = asset.parameters;
  if (!parameters || !Object.keys(parameters).length) {
    return ["旧记录 · 参数未保存"];
  }
  if (kind === "simulator") {
    return [
      `中心 ${parameters.longitude}°, ${parameters.latitude}°`,
      `半径 ${parameters.radius_km} km`,
      `振幅 ${parameters.amplitude_cm} cm`,
      `深度 ${parameters.influence_depth_m} m`,
      `结构 ${parameters.kind}`,
      `衰减 ${parameters.vertical_decay}`,
    ];
  }
  return [
    `模型 ${parameters.model}`,
    `权重 ${asset.weights?.filename || "未知"}`,
    `预测 ${parameters.steps} 天`,
    `设备 ${parameters.device}`,
    `AMP ${parameters.amp ? "开启" : "关闭"}`,
    `起始日期 ${parameters.start_date || "自动"}`,
  ];
}
