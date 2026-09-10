# Pisces-Explorer Architecture

本文描述 Pisces-Explorer 当前的模块边界、数据流、运行时隔离和持久化规则。面向用户的安装与操作说明参见 [README.md](README.md)。

## 总体结构

Pisces-Explorer 使用一个 FastAPI 后端提供四个独立页面：

| 页面 | 路径 | 主要职责 |
|---|---|---|
| 分析工作台 | `/` | 全域 NetCDF 浏览、对比和空间分析 |
| 区域分析 | `/region` | 先确定研究区，再对裁剪数据执行分析 |
| 模拟实验 | `/simulator` | 理想化中尺度涡旋构造 |
| 模型推理 | `/inference` | Pisces-Ocean 自回归预测 |

四个页面共享顶部导航和 Pisces-Hub 资产，但拥有独立的页面状态与操作流程。Explorer 和 Region 还拥有相互隔离的数据 Runtime。

```text
浏览器页面
├─ Explorer ─────── /api/* ────────── primary_runtime
├─ Region ───────── /region/api/* ─── region_runtime
├─ Simulator ────── /api/simulator/*
└─ Inference ────── /api/inference/*
                         │
                         ▼
                    Pisces-Hub
```

## 代码目录

```text
Pisces-Explorer/
├─ backend/
│  ├─ core/
│  │  ├─ feature_registry.py      # 后端功能注册表
│  │  ├─ runtime.py               # 双 Runtime 与请求作用域代理
│  │  ├─ session_store.py         # 进程内会话状态
│  │  ├─ variables.py             # 变量、单位、维度和默认显示设置
│  │  ├─ spatial.py               # 请求级空间裁剪
│  │  ├─ paths.py                 # Hub 与 Region 持久化路径
│  │  └─ compute_gate.py          # 高资源任务全局请求锁
│  ├─ plotting/
│  │  └─ common.py                # Plotly 公共布局和序列化能力
│  ├─ features/
│  │  ├─ dataset/                 # 上传、状态、元数据和配置接口
│  │  ├─ layer/                   # 二维水平切层
│  │  ├─ volume/                  # 三维分层显示
│  │  ├─ profile/                 # 单点垂直剖面
│  │  ├─ transect/                # 两点垂直断面
│  │  ├─ comparison/              # A/B 配对、差值和统计
│  │  ├─ region/                  # 研究区校验与 1 km 显示插值
│  │  ├─ simulator/               # 模拟任务适配层
│  │  ├─ inference/               # 推理任务适配层
│  │  └─ hub/                     # 持久化资产发现与解析
│  ├─ data.py                     # NetCDF 读取与声速计算
│  └─ main.py                     # FastAPI 装配和页面挂载
├─ frontend/
│  ├─ vue-app/                    # Vue 3 + TypeScript 多页面源码
│  │  └─ src/
│  │     ├─ components/           # 公共 Header 等组件
│  │     ├─ shared/               # 任务页共享组合逻辑
│  │     ├─ explorer/             # Explorer 页面入口
│  │     ├─ region/               # Region 页面与区域选择器
│  │     ├─ simulator/            # Simulator 页面
│  │     └─ inference/            # Inference 页面
│  ├─ js/                         # Explorer 工作区控制器
│  │  ├─ core/                    # API、SessionStore 和 PanelRegistry
│  │  ├─ components/              # 时间轴、面板和范围控件
│  │  ├─ interactions/            # 地图选点、拖动与框选
│  │  └─ features/                # 图层、三维、分析和数据控制器
│  ├─ pages/index.html            # Explorer/Region 共享工作区 DOM
│  ├─ vue-dist/                   # Vite 生产构建产物
│  └─ style.css                   # 全局样式
├─ Pisces-Region/                 # Region 说明与独立 viz_config.json
├─ Pisces-Simulator/              # 理想化涡旋算法实现
├─ Pisces-Ocean-Infer/            # Pisces-Ocean AR 推理实现
├─ Pisces-Hub/                    # 数据、模型、配置和任务结果
├─ README.md
└─ run.py
```

## 依赖方向

```text
backend/main.py
  → feature_registry
  → features
  → core / plotting / data

Vue 页面入口
  → Vue components / shared composables
  → Explorer compatibility runtime
  → frontend/js feature controllers
  → FastAPI API
```

约束如下：

- `core` 不导入具体业务 `features`。
- `router.py` 负责 HTTP 参数、错误映射和响应组合。
- `service.py` 负责数据处理与业务规则。
- `figure.py` 负责把准备好的数据转换为 Plotly figure。
- `main.py` 只负责应用、路由、中间件和静态页面装配。
- 公共绘图代码只有在至少两个功能共同使用时才进入 `plotting/common.py`。
- Simulator 和 Inference 的领域算法保留在各自根目录，后端 feature 只作为 Web 适配层。

## 页面与 API 装配

`backend/main.py` 从功能注册表装配通用 API。数据集、切层、三维、剖面、断面和对比路由会注册两次：

```text
/api/*          → Explorer 请求作用域
/region/api/*   → Region 请求作用域
```

中间件根据 URL 设置 `current_runtime_scope`。业务模块通过 RuntimeProxy 获取当前目标，不需要复制绘图和分析算法。

Simulator、Inference 和 Hub 使用自己的 `/api/simulator/*`、`/api/inference/*` 与 `/api/hub/*` 路由，不注册 Region 副本。

FastAPI 优先提供 `frontend/vue-dist` 中的 Vue 构建产物；构建产物不存在时，Explorer 可回退到 `frontend/pages/index.html`。

## Explorer 工作区

Explorer 使用左、右两个 Panel 槽位。每个槽位独立保存：

- 是否启用、当前视图和数据来源；
- 变量、日期、深度、范围和配色；
- 矢量密度和三维可见层；
- 单点/断面模式及当前会话内的选点。

`PanelRegistry` 定义每种视图支持的数据模式、变量维度和地图选点能力。当前编辑窗口决定左栏控制对象和底部分析来源。

普通模式下两个窗口可独立配置。`3D/2D 联动`开启后，左窗口固定承担三维角色，右窗口固定承担二维切层角色；变量、时间、来源、范围和区域等共享状态同步。点击三维层只请求右侧二维切层，不重绘三维体数据。

底部分析工具栏提供单点垂直剖面与两点垂直断面。分析来源严格跟随当前窗口的 A、B 或差值来源。两种模式分别保存选点历史，但刷新后不恢复坐标。

## Region 数据流

Region 必须先确认研究区域，再允许加载数据：

```text
中心点或四边界
  → /region/api/selection
  → 规范化研究区
  → 上传 NetCDF
  → xarray 按区域索引裁剪
  → region_runtime
```

中心点模式使用地球曲率修正生成沿经纬线方向的 `240 × 240 km` 区域；四边界模式保留用户指定范围。第一版不支持跨越国际日期变更线。

Region 与 Explorer 使用相同的数据、绘图、对比和分析功能，但所有请求通过 `/region/api/*` 访问 `region_runtime`。清空任一 Runtime 不影响另一侧。

### 二维 1 km 显示网格

Region 原始数组在加载后保持裁剪分辨率。只有水平切层在出图前执行双线性插值：

```text
裁剪后的二维层
  → 以研究区中心纬度换算目标经纬度步长
  → 约 1 km × 1 km 规则显示网格
  → Plotly 热力图
```

- 固定 `240 × 240 km` 区域通常生成 `241 × 241` 点。
- 自定义边界包含最终边界，实际步长不大于约 1 km。
- 任一必要源格点为 NaN 时，目标点保持 NaN，避免跨越海岸线填值。
- 流速、风速和波向先分别插值分量，再计算模长或方向。
- A 和 B 分别插值到同一目标网格，再计算 `A−B`。
- 插值结果按数据帧、变量、深度和区域缓存；加载新数据或清空会话时失效。
- 三维场、单点剖面和两点断面始终使用原始裁剪网格。
- Explorer 的二维切层不启用 Region 插值。

## Runtime 与状态边界

| 状态 | 保存位置 | 生命周期 |
|---|---|---|
| Explorer 当前数据、日期和 A/B 会话 | `primary_runtime` | FastAPI 进程存活期间 |
| Region 研究区、裁剪数据和 A/B 会话 | `region_runtime` | FastAPI 进程存活期间 |
| Explorer 显示和窗口配置 | `Pisces-Hub/configs/viz_config.json` | 跨刷新和后端重启 |
| Region 显示和窗口配置 | `Pisces-Region/viz_config.json` | 跨刷新和后端重启 |
| Simulator/Inference 表单和最后状态 | 浏览器 `localStorage` | 浏览器本地持久化 |
| 数据、模型和任务结果 | `Pisces-Hub/` | 长期文件资产 |
| 任务参数和产物索引 | 运行目录的 `manifest.json` | 与任务结果共同保存 |
| 时间播放预计算图 | 浏览器 Playback Cache | 配置变化或停止播放前 |

浏览器刷新时，前端通过 `/api/status` 或 `/region/api/status` 恢复数据摘要，并从对应配置接口恢复窗口设置。浏览器安全策略不允许恢复本地文件输入框。后端进程重启后 Runtime 数据消失，但 JSON 显示配置和 Hub 文件仍然存在。

清空 Explorer 或 Region 数据只清除对应 Runtime，不删除各自的显示配置。Region 的研究区属于 `region_runtime`，清空 Region 会话后需要重新确定区域。

## Pisces-Hub

Pisces-Hub 是本地持久化资产中心：

```text
Pisces-Hub/
├─ configs/viz_config.json
├─ data/                         # 规范 NetCDF 资产目录
├─ models/                       # 规范模型目录
├─ weights/                      # 兼容旧权重目录
└─ results/
   ├─ simulator/<run_id>/
   │  ├─ manifest.json
   │  └─ *.nc
   └─ inference/<run_id>/
      ├─ manifest.json
      └─ prediction_*.nc
```

Hub 资产服务同时识别根目录中的旧 `.nc` 文件、旧 `weights/` 模型和旧的平铺模拟结果。所有浏览器资产引用都使用后端生成的 ID，接口不接受任意文件系统路径。

Simulator 输出一个模拟 NetCDF；Inference 输出逐日预测序列。任务完成后可将结果重新载入 Explorer，或把符合条件的结果作为后续 Simulator/Inference 输入。

## 高资源任务协调

Inference 使用全局计算门控制高资源任务。推理运行期间，其他 `/api/*` 和 `/region/api/*` 请求返回锁定状态，只有当前推理任务的进度查询继续开放。这样可以避免绘图、上传、模拟或第二个推理任务与模型计算争用 CPU、GPU 和内存。

任务输出写入独立 `<run_id>` 目录，并通过 `manifest.json` 记录输入、模型、参数、完成时间和输出文件。上传到临时目录的输入与权重在任务结束后清理。

## 前端组合方式

四个页面均由 Vue 3 + TypeScript + Vite 构建。Simulator、Inference 和 Region 区域选择器主要由 Vue 组件实现。

Explorer 复杂工作区采用渐进迁移方式：Vue 管理页面生命周期、Header、侧栏外壳和 Region 页面装配；成熟的 Plotly 双窗口、播放、选点和分析逻辑继续由 `frontend/js` 控制器负责。`legacy-runtime.ts` 按固定顺序装配这些控制器，避免框架迁移改变数值与 WebGL 行为。

Vue 与旧控制器通过显式自定义事件同步工作区和面板状态，不依赖 MutationObserver 推断业务状态。保留的 DOM ID 是当前兼容接口的一部分，调整模板时不能随意删除。

## 扩展约定

新增后端业务功能时：

1. 在 `backend/features/<feature>/` 中实现路由，并按需要拆分 service 和 figure。
2. 在功能注册表中注册需要自动装配的 API。
3. 复用 `core`、`plotting` 和现有 Runtime 接口，不复制通用算法。
4. 新页面放入 `frontend/vue-app/src/<feature>/`，并在 Vite 多页面入口中注册。
5. 修改 Vue、TypeScript 或共享模板后重新生成 `frontend/vue-dist`。

修改 Explorer 工作区时，应保持 PanelRegistry 能力约束、左右窗口独立状态、旧请求失效控制和保留 DOM ID。修改 Region 数据链路时，应明确功能使用原始裁剪网格还是二维 1 km 显示网格，避免把显示插值意外带入三维或科学分析结果。

## 兼容层

`backend/figures.py` 和 `backend/comparison.py` 作为旧导入路径的兼容导出保留，不承载主要业务实现。Explorer 的共享 HTML 和部分 JavaScript 控制器同样属于迁移期兼容层；删除前必须确认 Vue 已覆盖相同行为和状态恢复能力。
