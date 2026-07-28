# Pisces-Explorer

基于 Python 3.11、FastAPI 和 Plotly 的海洋 NetCDF 交互式可视化工具。
系统支持单帧分析、时间序列分析和双序列对比，可展示声速、温度、盐度、
海流、风场和波浪等变量。

## 当前功能

### 三种数据模式

1. **单帧**
   - 在左侧数据集 A 中选择一个 `.nc` 文件。
   - 查看三维分层、水平切层、单点垂直剖面和两点垂直断面。

2. **时间序列**
   - 在左侧数据集 A 中一次选择至少两个 `.nc` 文件。
   - 按日期切换或自动播放不同时间帧。
   - 三维图、水平切层、剖面和断面随当前日期同步更新。

3. **双序列对比**
   - 在同一数据加载卡片中选择数据集 A 和数据集 B，每组至少两个 `.nc` 文件。
   - 后端按文件名中的日期配对。
   - 顶部两个窗口默认显示序列 A 和序列 B，也可把任一窗口切换为差值 `A − B`。
   - 显示当前切层的 MAE、RMSE、范围、均值和相邻帧变化。
   - 单点垂直剖面和两点垂直断面可明确选择序列 A 或序列 B。
   - 页面会列出实际配对的 A/B 文件，并提示连续帧内容完全相同的日期。

### 可视化能力

- 多深度层叠加的三维 Surface 图。
- 任意深度层的水平热力图。
- 海流、风场和波向矢量箭头。
- 单点垂直剖面。
- 两点连线的距离—深度断面。
- 时间轴切换和自动播放。
- 每个变量独立的色标范围、Plotly 配色和自定义渐变色。
- 三维显示层选择。
- 地图选点和点位拖动。
- 可拖动的侧栏、上下区域和左右图表分隔条。

## 支持变量

| 页面变量 | NetCDF 来源 | 维度 | 说明 |
|---|---|---|---|
| 声速 `ss` | `thetao` + `so` | 3D | 使用 Chen-Millero 公式计算 |
| 温度 `temp` | `thetao` | 3D | 必需 |
| 盐度 `salt` | `so` | 3D | 必需 |
| 东向流速 `uo` | `uo` | 3D | 可选 |
| 北向流速 `vo` | `vo` | 3D | 可选 |
| 合成流速 `uv` | `uo` + `vo` | 3D | 自动计算模长 |
| 东向风速 `u10` | `u10` | 2D | 可选 |
| 北向风速 `v10` | `v10` | 2D | 可选 |
| 合成风速 `wind` | `u10` + `v10` | 2D | 自动计算模长 |
| 有效波高 `swh` | `swh` | 2D | 可选 |
| 波向分量 | `mwd_u`、`mwd_v` | 2D | 可选 |
| 波向 `mwd` | `mwd_u` + `mwd_v` | 2D | 自动换算为 0–360° |

缺失的可选变量会使用 NaN 填充，并在页面元数据中标记为不可用。
二维表面变量没有垂直剖面或垂直断面。

## 环境要求

- Windows、macOS 或 Linux
- Python **3.11**
- 推荐使用独立 Conda 或 venv 环境

Conda 示例：

```powershell
conda create -n python3.11 python=3.11
conda activate python3.11
python -m pip install fastapi uvicorn xarray netcdf4 numpy plotly python-multipart
```

也可以直接在现有 Python 3.11 环境中安装：

```powershell
python -m pip install fastapi uvicorn xarray netcdf4 numpy plotly python-multipart
```

## 快速启动

安装依赖并在项目根目录启动：

```powershell
python -m pip install fastapi uvicorn xarray netcdf4 numpy plotly python-multipart
python run.py
```

浏览器访问：

```text
http://127.0.0.1:8000/
```

Windows 也可以直接运行：

```powershell
start.bat
```

`start.bat` 不包含本机绝对路径。它会依次尝试当前已激活的 Python 3.11、
名为 `python3.11` 的 Conda 环境，以及 Windows Python Launcher 的
`py -3.11`。这些方式都不可用或服务启动失败时，脚本会保留窗口并给出
明确提示，不会直接闪退。

启动参数会原样传递给 `run.py`：

```powershell
start.bat --port 8080
start.bat --debug
start.bat --nc_dir F:\path\to\data --date 20251220
```

使用 Python 直接启动时参数相同：

```powershell
python run.py --port 8080
python run.py --debug
```

### 启动时预加载单帧

```powershell
python run.py --nc_dir F:\path\to\data --date 20251220
```

该方式会查找：

```text
F:\path\to\data\prediction_20251220.nc
```

如果文件不存在，服务仍会正常启动，之后可以在页面上传文件。

## NetCDF 数据要求

### 必需内容

| 名称 | 要求 |
|---|---|
| `thetao` | `time × depth × latitude × longitude` |
| `so` | `time × depth × latitude × longitude` |
| `latitude` | 纬度坐标 |
| `longitude` | 经度坐标 |
| `time` | 当前读取第一个时间索引 `time=0` |

深度坐标支持以下名称：

```text
depth / deptht / lev / level / z_l / z_t
```

如果文件没有可识别的深度坐标，程序会使用内置的 20 层默认深度。实际数据
深度数量应与所使用的深度坐标数量一致。

### 时间序列文件名

时间序列和双序列对比要求每个文件名包含唯一的 8 位日期：

```text
prediction_20251220.nc
target_20251220.nc
ocean_20251221_result.nc
```

日期格式为：

```text
YYYYMMDD
```

单帧上传不要求文件名包含日期。

### 双序列配对规则

序列 A 和序列 B 按共同日期配对，而不是简单按照上传顺序配对：

```text
序列 A：prediction_20251220.nc
序列 B：target_20251220.nc
```

对比前会检查：

- 两边是否存在共同日期。
- `latitude`、`longitude` 和深度坐标是否一致。
- 三维网格形状是否一致。

只存在于某一边的日期不会进入对比结果，上传完成后会返回两边未配对的文件
数量。页面会显示每个日期实际使用的 A/B 文件。

## 界面操作

### 统一双槽位工作区

系统启动后直接进入主界面，不再显示单帧、时间序列、双序列三个独立入口。
左侧“数据加载”卡片根据文件数量自动判断模式：

- A 为 1 个文件、B 为空：单帧。
- A 为多个文件、B 为空：时间序列。
- A、B 各至少 2 个文件：双序列对比。

B 已选择但任一侧不足两个文件时不会提交，并显示明确校验信息。左侧其他
控制和右侧可视化仍在同一页面；数据加载前右侧显示操作说明，加载后切换为
顶部两个可视化窗口和底部一个分析窗口。

选择文件后，A/B 区域只显示“已选择 N 个文件”；点击该摘要可以展开带滚动
条的完整文件名清单，避免长文件名挤压侧栏。

左侧栏采用类似 ChatGPT 网页版的可折叠工作栏：

- 桌面端可收起成窄栏，并保留“加载数据”快捷按钮。
- 收起后的窄栏为每个可用分组显示一一对应的图标；桌面端点击图标只在
  窄栏右侧弹出该分组的控件，不展开整条侧栏。点击其他图标可切换内容，
  点击空白处或按 Esc 关闭。移动端仍使用完整抽屉。当前数据模式不可用的
  图标会自动隐藏。
- 展开/收起状态保存在浏览器中。
- 侧栏宽度变化后，所有可见 Plotly 图表会自动重新计算尺寸。
- 小屏幕下侧栏变成抽屉，点击遮罩即可关闭。
- 侧栏内部的数据概览、变量、色标、时间轴、深度和分析设置可以分别折叠，
  每个分组的展开状态独立保存。
- 侧栏线性图标集中存放在
  `frontend/assets/icons/sidebar-icons.svg`，作为一个 SVG Sprite 静态资源
  由浏览器单独请求和缓存；JavaScript 只引用图标 ID。

- 单帧和普通时间序列默认显示“三维场 / 水平切层”。
- 二维变量不支持三维场时，槽位自动回退为水平切层。
- 双序列默认显示“序列 A / 序列 B”，每个槽位都可独立选择序列 A、
  序列 B 或差值 A−B 的水平切层。三维变量还可以选择“三维场 · 序列 A”、
  “三维场 · 序列 B”或“三维场 · 差值 A−B”。
- 点击支持选点的顶部窗口会把它设为“当前分析窗口”；蓝色边框显示选点和
  拖动实际作用的位置。
- `A−B` 是两个配对数据场的差值，不是空间或时间插值。

### 变量和色标

- 在左侧变量卡片中切换变量。
- 色标范围和配色按变量独立保存。
- 自定义颜色时，两个十六进制颜色必须都是 `#RRGGBB` 格式。
- 合成矢量变量会显示矢量密度设置。

配置保存在：

```text
temp/viz_config.json
```

### 深度和三维显示层

- 深度下拉框和滑块控制当前水平切层。
- “3D 显示层”只控制三维图中参与显示的深度层。
- 三维显示层是当前会话的全局设置，切换变量时沿用同一组可见深度层。
- 二维表面变量会禁用三维场，并在垂直分析区域显示不支持原因。

### 单点垂直剖面

选择“单点垂直剖面”，然后点击水平地图。选点可以拖动，剖面随位置更新。
如果时间序列正在播放，开始拖动选点时会自动暂停播放，避免旧帧重绘覆盖
拖动中的位置。

### 两点垂直断面

选择“两点垂直断面”，依次选择 P1 和 P2。下方面板展示两点连线路径上的
距离—深度分布。

单点和断面模式分别保存自己的选点。切换模式不会永久删除另一种模式的
选点，切换回来后会恢复。

在双序列模式下，可以选择垂直分析的数据来源：

```text
序列 A / 序列 B
```

该选择器在下方分析面板标题旁以“分析数据来源”高亮显示。顶部差值图仍可
用于空间对比，但不会让用户误以为它是当前垂直分析的数据来源。

### 时间播放

时间序列或双序列包含多个共同日期时，会显示时间轴。可以手动选择日期，也
可以设置播放间隔后自动播放。系统会等待当前帧渲染完成后再安排下一帧，
避免多个帧请求互相覆盖。

### 面板尺寸

侧栏、左右图表和上下图表区域都可以拖动调整。每个分隔条都设置了最小尺寸，
上下区域不会把剖面/断面面板压缩到不可见。

## 项目结构

项目采用“核心注册表 + 公共绘图层 + 功能目录”的结构：

```text
Pisces-Explorer/
├─ backend/
│  ├─ core/                    # 功能/变量注册表和数据会话
│  ├─ plotting/                # 公共 Plotly 工具
│  ├─ features/
│  │  ├─ dataset/              # 单帧和序列导入
│  │  ├─ volume/               # 三维图
│  │  ├─ layer/                # 水平切层
│  │  ├─ profile/              # 单点垂直剖面
│  │  ├─ transect/             # 两点垂直断面
│  │  └─ comparison/           # 双序列配对和对比
│  ├─ data.py                  # NetCDF 读取和声速计算
│  └─ main.py                  # FastAPI 应用装配
├─ frontend/
│  ├─ assets/
│  │  └─ icons/                # 独立缓存的 SVG 图标资源
│  ├─ js/
│  │  ├─ core/                 # 状态、API、变量、面板注册表和 Plotly 配置
│  │  ├─ components/           # 时间轴、槽位外壳、范围控件和面板调整
│  │  ├─ interactions/         # 地图选点和拖动
│  │  └─ features/             # 工作区、控制器和各图表视图
│  ├─ app.js                   # 启动和跨功能渲染协调
│  ├─ index.html               # 页面结构和脚本入口
│  └─ style.css                # 页面样式
├─ tests/                      # API、架构和序列对比回归测试
├─ ARCHITECTURE.md             # 完整架构和扩展规则
├─ start.bat                   # Windows Python 3.11 启动脚本
└─ run.py                      # Python 3.11 启动入口
```

更完整的文件职责和扩展规则见 [ARCHITECTURE.md](ARCHITECTURE.md)。

## 常见修改位置

| 修改内容 | 主要位置 |
|---|---|
| 新增变量 | `backend/core/variables.py` |
| 修改 NetCDF 读取 | `backend/data.py`、`backend/features/dataset/` |
| 修改三维图 | `backend/features/volume/`、`frontend/js/features/volume/` |
| 修改水平切层 | `backend/features/layer/`、`frontend/js/features/layer/` |
| 修改单点剖面 | `backend/features/profile/`、`frontend/js/features/profile/` |
| 修改两点断面 | `backend/features/transect/`、`frontend/js/features/transect/` |
| 修改双序列对比 | `backend/features/comparison/`、`frontend/js/features/comparison/` |
| 修改变量或色标控制 | `frontend/js/features/controls/` |
| 修改地图选点 | `frontend/js/interactions/map-selection.js` |
| 修改启动和首次渲染 | `frontend/js/features/workspace/controller.js` |
| 修改顶部槽位类型或默认布局 | `frontend/js/core/panel-registry.js` |
| 修改双槽位渲染协调 | `frontend/js/features/workspace/panel-controller.js` |

## API 概览

| 方法 | 地址 | 说明 |
|---|---|---|
| GET | `/api/status` | 后端当前是否已加载数据 |
| POST | `/api/upload` | 上传单帧 |
| POST | `/api/upload_series` | 上传时间序列 |
| POST | `/api/upload_comparison` | 上传序列 A 和序列 B |
| GET | `/api/meta` | 深度、网格、变量和功能注册信息 |
| GET | `/api/dates` | 当前序列日期和配对文件 |
| GET | `/api/volume` | 三维图 |
| GET | `/api/layer/{depth_idx}` | 水平切层 |
| GET | `/api/comparison/layer/{depth_idx}` | A/B/差值切层 |
| GET | `/api/comparison/volume` | A/B/差值三维场 |
| POST | `/api/profile` | 单点垂直剖面 |
| POST | `/api/transect` | 两点垂直断面 |
| GET/POST | `/api/config` | 读取或保存显示配置 |

启动后可访问自动生成的接口文档：

```text
http://127.0.0.1:8000/docs
```

## 测试

使用 Python 3.11 运行后端和架构回归测试：

```powershell
python -m unittest discover -s tests -v
```

检查前端 JavaScript 语法：

```powershell
node --check frontend/app.js
Get-ChildItem frontend/js -Recurse -Filter *.js |
  ForEach-Object { node --check $_.FullName }
```

当前测试覆盖：

- 后端功能路由注册。
- 前端模块静态资源和加载顺序。
- SVG 图标 Sprite 的格式、图标 ID 和静态访问。
- A/B 序列按日期配对。
- 日期变化时序列 B 正确切换。
- A、B 和差值选择。
- MAE、RMSE 和相邻帧变化。
- 剖面和断面构图。
- `core` 不反向依赖具体功能模块。

## 打包

安装 PyInstaller：

```powershell
python -m pip install pyinstaller
```

项目包含动态功能路由，建议使用已有 spec 文件打包：

```powershell
pyinstaller PiscesExplorer.spec
```

生成结果位于：

```text
dist/PiscesExplorer.exe
```

## 当前限制

- 数据保存在后端内存中，服务重启后需要重新上传。
- 当前会话是单实例状态，更适合本地单用户使用。
- 每个 NetCDF 文件当前只读取 `time=0`；时间序列通过多个文件表达。
- 双序列只比较共同日期和相同网格。
- 大文件和大量时间帧会增加上传时间和内存占用。

## 更新记录

### 2026-07-28

- 增加双序列 A/B 对比和 `A − B` 差值。
- 增加对比指标、文件配对显示和连续相同帧提示。
- 剖面和断面支持选择 A、B 或差值。
- 后端重构为核心注册表、公共绘图层和功能目录。
- 前端拆分为 core、components、interactions 和 feature controllers。
- 增加架构、API 和序列 B 日期切换回归测试。
- 修复时间播放与拖动选点竞态，并阻止旧地图请求覆盖新状态。
- 单点和断面模式分别保存选点，切换模式后可以恢复。
- 统一上下分隔条边界，并强化双序列“当前数据来源”提示。
- 主工作区统一为双可视化槽位和单个垂直分析窗口。
- 删除独立上传首页，三种数据模式由左侧 A/B 文件数量自动判断。
- 左侧参数区改为可折叠工作栏，并增加移动端抽屉布局。
- 增加前端面板注册表；相同视图可在两个槽位中独立显示。
- 双序列槽位共享一次 A/B/差值请求，并明确区分“差值”和“插值”。
- 侧栏图标迁移到独立 SVG Sprite，由浏览器统一缓存。
- Windows 启动脚本移除本机绝对路径，并自动选择 Python 3.11。

### 2026-07-06

- 增加时间序列播放和三维显示层选择。
- 优化矢量箭头和波向显示。
- 修复三维层索引、色标范围和合成波向箭头问题。
