# Pisces-Explorer

Pisces-Explorer 是一个面向海洋 NetCDF 数据的本地分析平台，使用 FastAPI、Vue 3、TypeScript 和 Plotly 构建。平台由四个独立页面组成：分析工作台、区域分析、模拟实验和模型推理；它们共享顶部导航与 Pisces-Hub 数据资产，但拥有各自的操作流程。

## 功能入口

启动服务后可访问以下四个独立页面：

| 页面 | 地址 | 用途 |
|---|---|---|
| 分析工作台 | `/` | 加载单帧、时间序列或 A/B 数据，进行 2D、3D、剖面和断面分析 |
| 区域分析 | `/region` | 先确定研究区域，再加载并分析该区域内的数据 |
| 模拟实验 | `/simulator` | 在背景流场中构造理想化中尺度涡旋 |
| 模型推理 | `/inference` | 使用 Pisces-Ocean v5 AR 模型生成逐日预测 |

### 分析工作台

- 支持单个 NetCDF 文件、时间序列以及 A/B 对比。
- 提供左、右两个可独立配置的显示窗口。
- 支持水平切层、三维场、单点垂直剖面和两点垂直断面。
- A/B 模式可显示序列 A、序列 B 或差值 `A−B`。
- `3D/2D 联动`固定左侧为三维场、右侧为对应切层；点击三维层时只更新二维窗口。
- 支持时间播放、深度、色标范围、预设配色、矢量密度、三维可见层和区域框选。

### 区域分析

区域分析使用独立于 Explorer 的数据会话和显示配置。

- 中心点模式生成沿经纬线方向的 `240 × 240 km` 研究区。
- 四边界模式接受任意有效矩形范围，第一版不支持跨越国际日期变更线。
- 地图支持点击选点、拖动平移、缩放和定位当前选区。
- 数据在加载阶段先按研究区裁剪，Region 运行时不保存完整空间场。
- 二维水平切层在显示阶段以双线性插值生成约 `1 km × 1 km` 网格；固定区域通常为 `241 × 241` 点。
- 三维场、单点剖面和两点断面继续使用裁剪后的原始分辨率。
- A、B 和差值二维图共享相同的 1 km 显示网格。

### 模拟实验

- 可上传背景 NetCDF，也可选择 Pisces-Hub 中已有的数据资产。
- 可设置涡心、半径、SSH 振幅、影响深度、水平结构和垂向衰减。
- 支持在表层流速预览图上选择涡心。
- 输出保留原温盐场，修改 `uo`、`vo`，并重新生成 `current_speed` 和 `current_direction`。
- 结果保存至 `Pisces-Hub/results/simulator/<run_id>/`，可重新加载到 Explorer。

### 模型推理

- 使用单时刻 GLORYS NetCDF 和 Pisces-Ocean v5 AR checkpoint 进行多日自回归预测。
- 支持 CUDA；CUDA 不可用时可回退到 CPU。
- 页面显示任务进度，结果按日期输出 NetCDF。
- 结果保存至 `Pisces-Hub/results/inference/<run_id>/`，可供其他工作流继续使用。
- 推理运行期间锁定其他 API 请求，避免多个高资源任务同时执行；任务进度查询除外。

## 快速开始

### 环境要求

- Python 3.11
- Node.js（仅修改或重新构建前端时需要）
- Windows、macOS 或 Linux
- 模型推理建议使用支持 CUDA 的 NVIDIA GPU

建议使用独立环境：

```powershell
conda create -n pisces python=3.11
conda activate pisces
python -m pip install -r requirements.txt
```

### 启动服务

在项目根目录运行：

```powershell
python run.py
```

Windows 也可以运行：

```powershell
start.bat
```

浏览器访问 `http://127.0.0.1:8000/`。

常用启动参数：

```powershell
python run.py --port 8080
python run.py --debug
python run.py --nc_dir F:\path\to\data --date 20251220
```

最后一条命令会尝试预加载 `F:\path\to\data\prediction_20251220.nc`。文件不存在时服务仍会正常启动，可随后在页面中选择数据。

## NetCDF 数据要求

### 必需字段

| 字段 | 维度或说明 |
|---|---|
| `thetao` | `time × depth × latitude × longitude`，海水温度 |
| `so` | `time × depth × latitude × longitude`，盐度 |
| `latitude` | 一维纬度坐标 |
| `longitude` | 一维经度坐标 |
| `time` | 每个文件读取第一个时间位置 `time=0` |

深度坐标支持：

```text
depth / deptht / lev / level / z_l / z_t
```

如果没有可识别的深度坐标，程序会使用内置的 20 层深度；数据的深度维长度必须与之匹配。

### 可选字段

| 字段 | 用途 |
|---|---|
| `uo`、`vo` | 三维海流分量 |
| `current_speed` | 已计算的合成流速；缺少时由 `uo`、`vo` 计算 |
| `current_direction` | 海流方向，正北为 0°、顺时针增加 |
| `u10`、`v10` | 十米风分量 |
| `swh` | 有效波高 |
| `mwd_u`、`mwd_v` | 波向分量 |

缺失的可选字段会作为不可用变量处理。二维变量不提供垂直剖面或垂直断面。

### 页面变量

| 页面变量 | 数据来源 | 类型 |
|---|---|---|
| 声速 `ss` | `thetao`、`so` 和深度，使用 Chen–Millero 公式 | 3D |
| 温度 `temp` | `thetao` | 3D |
| 盐度 `salt` | `so` | 3D |
| 东向/北向流速 `uo`、`vo` | 同名字段 | 3D |
| 合成流速 `uv` | `current_speed` 或 `uo`、`vo` | 3D 矢量 |
| 东向/北向风速 `u10`、`v10` | 同名字段 | 2D |
| 合成风速 `wind` | `u10`、`v10` | 2D 矢量 |
| 有效波高 `swh` | `swh` | 2D |
| 波向 `mwd` | `mwd_u`、`mwd_v` | 2D 矢量 |

## 文件组织与 A/B 配对

时间序列文件名必须包含一个八位日期，例如：

```text
prediction_20251220.nc
target_20251220.nc
ocean_20251221_result.nc
```

- A 中选择一个文件：单帧模式。
- A 中选择多个文件：时间序列模式。
- A、B 各选择一个文件：单帧 A/B 对比，允许文件日期不同。
- A、B 各选择多个文件：按文件名中的共同日期配对，不按上传顺序配对。
- A/B 对比要求两侧裁剪后的经度、纬度、深度和数组形状兼容。

## 数据与配置持久化

```text
Pisces-Hub/
├─ configs/
│  └─ viz_config.json            # Explorer 显示和窗口配置
├─ data/                         # 规范的 NetCDF 数据资产目录（可选）
├─ models/                       # 规范的模型权重目录（可选）
├─ weights/                      # 兼容保留的旧模型权重目录
└─ results/
   ├─ simulator/
   │  └─ <run_id>/               # 模拟 NetCDF 与 manifest.json
   └─ inference/
      └─ <run_id>/               # 逐日预测 NetCDF 与 manifest.json

Pisces-Region/
└─ viz_config.json               # Region 独立显示和窗口配置
```

- Explorer 与 Region 使用彼此独立的运行时和 JSON 配置。
- 为兼容旧数据，Pisces-Hub 根目录中的 `.nc` 文件和 `weights/` 中的权重也会被资产列表识别；新资产建议分别放入 `data/` 和 `models/`。
- 清空当前数据不会删除显示配置。
- 刷新页面可恢复已加载数据摘要和主要窗口配置，但不会恢复分析选点。
- 浏览器不能恢复本地文件输入框；重新上传时需要再次选择文件。
- 后端会话位于进程内存中，后端进程重启后需要重新加载 NetCDF。

## 前端开发

Vue 多页面工程位于 `frontend/vue-app`。修改 Vue、TypeScript 或共享页面模板后需要重新构建：

```powershell
cd frontend\vue-app
npm install
npm run typecheck
npm run build
```

构建结果写入 `frontend/vue-dist`，FastAPI 会优先提供其中的页面。

启动 Vite 开发服务器：

```powershell
cd frontend\vue-app
npm run dev
```

Vite 会将 `/api`、`/region/api` 和 `/static` 代理到 `http://127.0.0.1:8000`，因此后端需要同时运行。

## 项目结构

```text
backend/
├─ core/                         # Runtime、会话、变量注册和公共基础设施
├─ features/                     # dataset、layer、volume、profile、transect 等功能
└─ plotting/                     # Plotly 公共绘图支持

frontend/
├─ vue-app/                      # Vue 3 + TypeScript 源码
├─ js/                           # Explorer 控制器和交互模块
├─ pages/                        # 共享工作区模板
└─ vue-dist/                     # Vite 生产构建产物

Pisces-Region/                   # Region 独立配置与说明
Pisces-Simulator/                # 理想化涡旋实现
Pisces-Ocean-Infer/              # AR NetCDF 推理实现
Pisces-Hub/                      # 数据、模型、配置和结果资产
tests/                           # 单元测试与 API 回归测试
```

更详细的模块边界、状态流和扩展规则参见 [ARCHITECTURE.md](ARCHITECTURE.md)。

## License

见 [LICENSE](LICENSE)。
