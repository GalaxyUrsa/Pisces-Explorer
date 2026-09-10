# Pisces-Hub

Pisces 平台的本地持久化资产中心。Explorer、Simulator 和 Inference
产生的长期文件统一保存在这里：

```text
Pisces-Hub/
├── data/                  数据资产
├── models/                模型与权重资产
├── results/
│   ├── simulator/         模拟 NetCDF
│   ├── inference/         Explorer 推理任务结果
│   └── inference_AR/      独立 AR CLI 推理结果
└── configs/
    └── viz_config.json    Explorer 显示配置
```

网页上传的初始场和权重仅用于当前任务，仍在系统临时目录中处理并在任务
完成后清理，不作为 Hub 的长期资产保存。

Explorer 会把这里的内容作为历史资产：

- `data/`、Hub 根目录中的 `.nc`、模拟结果和推理结果帧均可作为新任务输入。
- `models/` 和兼容保留的 `weights/` 中的 `.pth`、`.pt`、`.ckpt` 可作为推理权重。
- 一次推理目录作为一条历史记录；从页面删除时会整条删除。
- 删除操作不可恢复，任务页面会先要求确认。

Simulator 和 Inference 的新任务都采用相同的运行目录结构：

```text
results/<task_type>/<run_id>/
├── manifest.json           输入、参数、时间和输出索引
└── *.nc                    一个模拟结果或多日推理结果
```

历史页面从 `manifest.json` 展示参数。升级前保存在
`results/simulator/*.nc` 的旧模拟文件仍然可载入和删除，但会标记为
“参数未保存”。
