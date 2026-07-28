# Pisces-Explorer Architecture

Pisces-Explorer 采用“核心注册表 + 公共绘图能力 + 功能目录”的结构。
每个业务功能尽量独立存放，使新增或修改功能时，改动主要限制在对应的
`features/<功能名>/` 目录中。

## 目标目录结构

```text
Pisces-Explorer/                            # 项目根目录
├─ backend/                                # Python 3.11 + FastAPI 后端
│  ├─ core/                               # 不依赖具体业务功能的后端核心能力
│  │  ├─ feature_registry.py              # 后端功能注册表，统一装配各功能路由
│  │  ├─ variables.py                     # 海洋变量注册表：名称、单位、维度、色标和默认范围
│  │  ├─ runtime.py                       # 当前数据会话、帧选择和通用变量读取
│  │  └─ session_store.py                 # 单次运行期间的内存状态容器
│  ├─ plotting/                           # 多个功能共用的 Plotly 绘图基础能力
│  │  └─ common.py                        # 公共布局、颜色条、NaN 处理和序列化工具
│  ├─ features/                           # 按业务功能组织的后端模块
│  │  ├─ dataset/                         # 单帧和时间序列的数据导入功能
│  │  │  ├─ router.py                     # 上传、状态、日期和元数据 HTTP 接口
│  │  │  └─ service.py                    # NetCDF 加载、临时文件和数据会话初始化
│  │  ├─ volume/                          # 三维分层可视化功能
│  │  │  ├─ router.py                     # 三维图查询参数和 HTTP 接口
│  │  │  ├─ service.py                    # 默认三维图的数据准备和会话缓存
│  │  │  └─ figure.py                     # 三维 Surface 图构建逻辑
│  │  ├─ layer/                           # 水平深度层可视化功能
│  │  │  ├─ router.py                     # 水平切层、选点和矢量密度 HTTP 接口
│  │  │  └─ figure.py                     # 热力图、选点标记和矢量箭头构建逻辑
│  │  ├─ profile/                         # 单点垂直剖面功能
│  │  │  ├─ router.py                     # 单点坐标和剖面参数 HTTP 接口
│  │  │  ├─ schema.py                     # 单点剖面 API 请求数据模型
│  │  │  └─ figure.py                     # 数值随深度变化的剖面图构建逻辑
│  │  ├─ transect/                        # 两点垂直断面功能
│  │  │  ├─ router.py                     # P1/P2 坐标和断面参数 HTTP 接口
│  │  │  ├─ schema.py                     # 两点坐标和断面 API 请求数据模型
│  │  │  └─ figure.py                     # 连线路径距离—深度断面图构建逻辑
│  │  └─ comparison/                      # 序列 A、序列 B 及其差值对比功能
│  │     ├─ router.py                     # 双序列上传和对比结果 HTTP 接口
│  │     ├─ service.py                    # 日期配对、A/B 数据选择、差值和统计指标
│  │     └─ figure.py                     # A、B、A−B 对比图的组合构建逻辑
│  ├─ data.py                             # 底层 NetCDF 读取、声速计算和坐标工具
│  └─ main.py                             # FastAPI 应用装配、功能注册和静态页面挂载
├─ frontend/                              # 原生 JavaScript + Plotly 前端
│  ├─ assets/icons/                       # 可独立缓存的 SVG 图标资源
│  │  └─ sidebar-icons.svg                # 侧栏图标 Sprite 和 symbol ID
│  ├─ js/                                 # 拆分后的前端源代码
│  │  ├─ core/                            # API、状态、变量/面板注册表和图表配置
│  │  │  └─ panel-registry.js             # 槽位视图能力、模式约束和默认布局
│  │  ├─ components/                      # 时间轴、范围选择器、槽位外壳和面板缩放
│  │  │  └─ panel-slot.js                 # 单个槽位的 DOM、状态和 Plotly resize
│  │  ├─ interactions/                    # 地图选点、拖动和其他跨视图交互
│  │  └─ features/                        # 按前端业务职责组织的页面功能
│  │     ├─ controls/                     # 侧栏设置和分析操作控制器
│  │     │  ├─ range-controls.js          # 色标、深度范围和数值范围配置
│  │     │  ├─ variable-controls.js       # 变量选择、维度模式和矢量密度
│  │     │  ├─ layer-visibility-controls.js # 三维图可见深度层选择
│  │     │  ├─ analysis-controls.js       # 深度选择、单点/断面模式和清除选点
│  │     │  └─ visualization-controls.js  # 组合上述独立可视化控制器
│  │     ├─ workspace/                    # 会话初始化、双槽位选择和渲染协调
│  │     │  └─ panel-controller.js        # 两个槽位、共享请求及当前分析窗口
│  │     ├─ dataset/                      # 单帧、序列和双序列上传控制器
│  │     ├─ volume/                       # 三维图请求和渲染视图
│  │     ├─ layer/                        # 水平切层请求和渲染视图
│  │     ├─ profile/                      # 单点垂直剖面请求和渲染视图
│  │     ├─ transect/                     # 两点垂直断面请求和渲染视图
│  │     └─ comparison/                   # A、B 和 A−B 对比渲染视图
│  ├─ app.js                              # 前端启动入口及少量跨功能协调
│  ├─ index.html                          # 页面结构和前端脚本加载入口
│  └─ style.css                           # 全局布局、主题和组件样式
├─ tests/                                 # Python 单元测试、API 测试和回归测试
├─ ARCHITECTURE.md                        # 项目结构、依赖方向和扩展规则
└─ run.py                                 # Python 3.11 本地启动入口
```

## 依赖方向

代码依赖必须遵循以下方向：

```text
main.py → feature_registry → features → core / plotting / data
frontend/app.js → features / components → core
```

具体约束：

- `core` 不能导入任何具体的 `features` 模块。
- `plotting/common.py` 只能存放至少两个绘图功能都会使用的代码。
- `router.py` 负责参数校验和 HTTP 输入输出，不堆积数据处理逻辑。
- `service.py` 负责业务处理，不直接操作页面或 DOM。
- `figure.py` 只负责把准备好的数据转换成 Plotly figure。
- `main.py` 只装配应用，不实现具体业务。
- `frontend/app.js` 只启动应用和协调跨功能事件，不实现完整功能。

## 统一工作区和面板注册表

应用只有一个主页面，不再维护独立上传页。`dataset/upload-controller.js`
根据左侧数据集 A/B 的文件数量选择现有上传 API：A 单文件调用 `/api/upload`，
A 多文件调用 `/api/upload_series`，A/B 均为多文件时调用
`/api/upload_comparison`。模式只由这一处推断，工作区和各视图不重复判断
文件数量。

右侧工作区只有一套 DOM 骨架：顶部 `slot-left`、`slot-right` 两个可复用
可视化槽位，底部一个单点垂直剖面/两点垂直断面分析窗口。

`frontend/js/core/panel-registry.js` 定义视图名称、支持的数据模式、变量维度
要求和是否允许地图选点。单帧与普通序列默认是“三维场 / 水平切层”，双
序列默认是“序列 A / 序列 B”。A、B、差值可以重复或交换出现在两个槽位，
不会依赖功能专属 DOM ID。

`panel-controller.js` 根据注册表协调渲染。双序列接口一次返回 A、B 和 A−B，
控制器只发起一个共享请求，再按各槽位选择分发 figure。`activeAnalysisSlot`
记录当前分析窗口，地图选点和拖动只由该槽位接收，两个地图槽位同步显示
点位。这里的“差值 A−B”是配对场相减，不是插值。

双序列三维视图使用 `/api/comparison/volume`，通过
`comparison_source=a|b|difference` 明确数据来源。二维切层仍共享一次
`/api/comparison/layer/{depth_idx}` 请求；三维场按可见槽位和来源独立请求，
避免在用户没有打开三维视图时构造体积较大的 Plotly figure。

`components/sidebar-controller.js` 只管理侧栏展开状态、浏览器持久化、移动端
抽屉和布局变化后的 Plotly resize，不读取 NetCDF，也不负责数据模式判断。
`components/sidebar-sections.js` 为带 `data-section` 的侧栏卡片统一添加键盘
可访问的折叠行为、独立持久化和收起栏图标映射。桌面收起状态复用原控件
节点显示单分组浮层，移动端仍交给完整抽屉。
组件不包含任何变量、深度或上传业务逻辑。
图标路径和矢量轮廓集中在 `frontend/assets/icons/sidebar-icons.svg`；组件只
生成引用对应 symbol ID 的 `<use>`，避免在 JavaScript 中重复保存 SVG 路径。

新增一个纯前端槽位视图时，优先只需要：

1. 在 `panel-registry.js` 注册能力和可用模式。
2. 在对应 `frontend/js/features/<feature>/view.js` 实现目标容器驱动渲染。
3. 在 `panel-controller.js` 增加最小的渲染分派。
4. 增加槽位默认值、重复选择和旧请求失效测试。

## 功能修改位置

| 修改目标 | 主要修改位置 |
|---|---|
| 新增或调整海洋变量 | `backend/core/variables.py` |
| 修改 NetCDF 读取格式 | `backend/data.py`、`backend/features/dataset/service.py` |
| 修改三维图 | `backend/features/volume/figure.py`、`frontend/js/features/volume/` |
| 修改水平切层 | `backend/features/layer/figure.py`、`frontend/js/features/layer/` |
| 修改单点垂直剖面 | `backend/features/profile/`、`frontend/js/features/profile/` |
| 修改两点垂直断面 | `backend/features/transect/`、`frontend/js/features/transect/` |
| 修改序列对比 | `backend/features/comparison/`、`frontend/js/features/comparison/` |
| 修改时间播放 | `frontend/js/components/timeline.js` |
| 修改地图选点或拖动 | `frontend/js/interactions/` |
| 修改变量、色标或显示层控制 | `frontend/js/features/controls/visualization-controls.js` |
| 修改深度或单点/断面模式 | `frontend/js/features/controls/analysis-controls.js` |
| 修改工作区首次加载流程 | `frontend/js/features/workspace/controller.js` |
| 修改统一 A/B 数据加载逻辑 | `frontend/js/features/dataset/upload-controller.js` |
| 修改槽位类型和默认布局 | `frontend/js/core/panel-registry.js` |
| 修改双槽位渲染协调 | `frontend/js/features/workspace/panel-controller.js` |
| 新增完整功能 | 新建前后端同名功能目录，并加入功能注册入口 |

## 新增功能规则

新增一个独立功能时：

1. 在 `backend/features/<feature>/` 中创建 `router.py`。
2. 按需要增加 `service.py` 和 `figure.py`，不要创建空文件。
3. 在 `backend/core/feature_registry.py` 中注册后端功能。
4. 在 `frontend/js/features/<feature>/` 中创建前端视图或控制器。
5. 在 `frontend/index.html` 中加载前端入口脚本。
6. 在 `tests/` 中增加功能服务和 API 回归测试。

## 当前迁移状态

上述正式目标结构已经完成主体迁移：

- 公共 Plotly 能力位于 `backend/plotting/common.py`。
- 各类图形已经进入对应功能的 `figure.py`。
- NetCDF 上传临时文件处理已经进入 `dataset/service.py`。
- `backend/core` 不再导入任何具体 `features` 模块。
- 地图选点和拖动已经进入 `frontend/js/interactions/map-selection.js`。
- 双端范围控件和面板调整等通用交互已经进入 `components`。
- 工作区初始化、可视化设置和分析模式已经从 `app.js` 拆入独立控制器。

为避免破坏旧测试或外部调用，`backend/figures.py` 和
`backend/comparison.py` 暂时作为兼容导出保留，不再承载实际业务实现。
现有 API 地址保持不变。

## 验证命令

统一使用 Python 3.11：

```powershell
D:\Anaconda\envs\python3.11\python.exe -m unittest discover -s tests -v
```

检查前端 JavaScript 语法：

```powershell
Get-ChildItem frontend\js -Recurse -Filter *.js |
  ForEach-Object { node --check $_.FullName }
node --check frontend\app.js
```
