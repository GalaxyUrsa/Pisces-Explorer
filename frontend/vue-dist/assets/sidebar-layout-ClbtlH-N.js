import{d as F,o as O,a as U,b,c as m,g as i,F as B,l as N,p as J,f as j,y as T,t as h,i as E,s as C,x as G,e as H,T as Q,r as R,h as X}from"./AppHeader.vue_vue_type_script_setup_true_lang-BtDaSaRY.js";const Pe=`<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Pisces-Explorer</title>
  <link rel="stylesheet" href="/static/style.css?v=27" />
  <script src="/static/plotly.min.js?v=6.7.0"><\/script>
</head>
<body>

  <!-- ── 主界面 ── -->
  <div id="main-screen" class="main-screen no-data">
    <div class="body-row">
      <button
        id="sidebar-toggle"
        class="sidebar-toggle"
        type="button"
        aria-label="收起左侧栏"
        aria-expanded="true"
        title="收起左侧栏"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <use href="/static/assets/icons/sidebar-icons.svg?v=1#menu"></use>
        </svg>
      </button>

      <!-- 左侧边栏 -->
      <div class="sidebar">
        <div id="sidebar-vue-context"></div>
        <nav
          id="sidebar-rail-nav"
          class="sidebar-rail-nav"
          aria-label="侧栏功能导航"
        ></nav>

        <div class="side-card data-source-card" data-section="data" data-default-open="true">
          <h1 class="gradient-title sidebar-brand">
            <span class="brand-icon">🌊</span>
            <span class="brand-text">Pisces-Explorer</span>
          </h1>
          <section id="current-session-summary" class="current-session-summary hidden">
            <div class="current-session-heading">
              <strong>当前已加载</strong>
              <span id="current-session-mode"></span>
            </div>
            <div id="current-dataset-a" class="current-dataset-row"></div>
            <div id="current-dataset-b" class="current-dataset-row hidden"></div>
            <div id="current-session-dates" class="current-session-dates"></div>
            <div class="current-session-actions">
              <button type="button" id="replace-data-btn" class="range-btn">重新选择数据</button>
              <button type="button" id="reload-btn" class="text-danger-btn">清空当前数据</button>
            </div>
          </section>
          <div id="dataset-replacement-editor">
          <div class="data-source-heading">
            <strong id="data-editor-title">数据加载</strong>
            <small>选择 1 个 NetCDF 文件为单帧，选择多个为时间序列</small>
          </div>
          <section class="dataset-select-block" id="dataset-a-section">
            <div class="dataset-select-heading"><strong>数据集 A</strong><span>必选</span></div>
            <label class="dataset-file-control" id="dataset-a-picker">
              <span class="dataset-file-summary" id="dataset-a-summary">尚未选择文件</span>
              <span class="dataset-file-action" id="dataset-a-action">选择文件</span>
              <input type="file" id="dataset-a-input" accept=".nc" multiple hidden />
            </label>
            <details id="dataset-a-files" class="dataset-file-details hidden"></details>
          </section>
          <button type="button" id="add-dataset-b" class="add-comparison-btn">＋ 添加对比数据集 B</button>
          <section class="dataset-select-block hidden" id="dataset-b-section">
            <div class="dataset-select-heading">
              <strong>数据集 B</strong><span>对比</span>
              <button type="button" id="remove-dataset-b" class="remove-dataset-btn">移除 B</button>
            </div>
            <label class="dataset-file-control" id="dataset-b-picker">
              <span class="dataset-file-summary" id="dataset-b-summary">尚未选择文件</span>
              <span class="dataset-file-action" id="dataset-b-action">选择文件</span>
              <input type="file" id="dataset-b-input" accept=".nc" multiple hidden />
            </label>
            <details id="dataset-b-files" class="dataset-file-details hidden"></details>
            <p class="comparison-picker-help">A、B 各选 1 个文件，或各选至少 2 个文件组成时间序列</p>
          </section>
          <div id="upload-status" class="upload-status"></div>
          <div class="data-load-actions">
            <button id="load-data-btn" class="play-btn" disabled>请选择数据</button>
            <button id="cancel-replace-btn" class="reload-btn hidden">取消</button>
          </div>
          </div>
          <div id="loaded-filename" class="loaded-filename hidden"></div>
        </div>

        <div class="side-card" data-section="overview">
          <div class="side-card-title">📊 数据概览</div>
          <div class="meta-grid">
            <div class="meta-item">
              <div class="meta-label">经度范围</div>
              <div class="meta-value" id="meta-lon">--</div>
            </div>
            <div class="meta-item">
              <div class="meta-label">纬度范围</div>
              <div class="meta-value" id="meta-lat">--</div>
            </div>
            <div class="meta-item">
              <div class="meta-label">深度层数</div>
              <div class="meta-value" id="meta-depths">--</div>
            </div>
            <div class="meta-item">
              <div class="meta-label" id="meta-grid-label">网格尺寸</div>
              <div class="meta-value" id="meta-grid">--</div>
            </div>
            <div class="meta-item hidden" id="meta-display-grid-item">
              <div class="meta-label">2D 显示</div>
              <div class="meta-value" id="meta-display-grid">--</div>
            </div>
          </div>
        </div>

        <div class="side-card hidden" id="comparison-files-card" data-section="comparison-files">
          <div class="side-card-title">📁 已读取的对比序列</div>
          <div class="comparison-file-header">
            <span>日期</span><span>序列 A</span><span>序列 B</span>
          </div>
          <div id="comparison-files-list" class="comparison-files-list"></div>
        </div>

        <div class="side-card" data-section="variables" data-default-open="true">
          <div class="side-card-title">视图与变量</div>

          <!-- 3D 变量分组 -->
          <div class="var-group">
            <div class="var-group-header" data-group="3d">
              <span class="var-group-arrow">▼</span>
              <span>3D 变量（有深度）</span>
            </div>
            <div class="var-group-body" id="var-group-3d">
              <div class="var-list" id="var-tabs-3d">
                <button class="var-card active" data-var="ss">
                  <div class="var-icon">🌊</div>
                  <div class="var-info"><div class="var-name">声速</div></div>
                  <div class="var-unit">m/s</div>
                </button>
                <button class="var-card" data-var="temp">
                  <div class="var-icon">🌡️</div>
                  <div class="var-info"><div class="var-name">温度</div></div>
                  <div class="var-unit">°C</div>
                </button>
                <button class="var-card" data-var="salt">
                  <div class="var-icon">🧂</div>
                  <div class="var-info"><div class="var-name">盐度</div></div>
                  <div class="var-unit">psu</div>
                </button>
                <button class="var-card" data-var="uv">
                  <div class="var-icon">🌀</div>
                  <div class="var-info"><div class="var-name">流速（合成）</div></div>
                  <div class="var-unit">m/s</div>
                </button>
                <button class="var-card" data-var="uo">
                  <div class="var-icon">→</div>
                  <div class="var-info"><div class="var-name">东向流速</div></div>
                  <div class="var-unit">m/s</div>
                </button>
                <button class="var-card" data-var="vo">
                  <div class="var-icon">↑</div>
                  <div class="var-info"><div class="var-name">北向流速</div></div>
                  <div class="var-unit">m/s</div>
                </button>
              </div>
            </div>
          </div>

          <!-- 2D 变量分组 -->
          <div class="var-group" style="margin-top:8px">
            <div class="var-group-header" data-group="2d">
              <span class="var-group-arrow">▶</span>
              <span>2D 表面变量</span>
            </div>
            <div class="var-group-body hidden" id="var-group-2d">
              <div class="var-list" id="var-tabs-2d">
                <button class="var-card" data-var="wind">
                  <div class="var-icon">💨</div>
                  <div class="var-info"><div class="var-name">风速（合成）</div></div>
                  <div class="var-unit">m/s</div>
                </button>
                <button class="var-card" data-var="u10">
                  <div class="var-icon">→</div>
                  <div class="var-info"><div class="var-name">风速 u10</div></div>
                  <div class="var-unit">m/s</div>
                </button>
                <button class="var-card" data-var="v10">
                  <div class="var-icon">↑</div>
                  <div class="var-info"><div class="var-name">风速 v10</div></div>
                  <div class="var-unit">m/s</div>
                </button>
                <button class="var-card" data-var="swh">
                  <div class="var-icon">🌊</div>
                  <div class="var-info"><div class="var-name">有效波高</div></div>
                  <div class="var-unit">m</div>
                </button>
                <button class="var-card" data-var="mwd">
                  <div class="var-icon">🧭</div>
                  <div class="var-info"><div class="var-name">波向</div></div>
                  <div class="var-unit">°</div>
                </button>
                <button class="var-card" data-var="mwd_u" style="display:none">
                  <div class="var-icon">→</div>
                  <div class="var-info"><div class="var-name">波向 u</div></div>
                  <div class="var-unit"></div>
                </button>
                <button class="var-card" data-var="mwd_v" style="display:none">
                  <div class="var-icon">↑</div>
                  <div class="var-info"><div class="var-name">波向 v</div></div>
                  <div class="var-unit"></div>
                </button>
              </div>
            </div>
          </div>
        </div>

        <div class="side-card" data-section="color-range">
          <div class="cbar-range-sidebar">
            <input type="number" class="range-input" id="cmin" placeholder="min" />
            <span class="range-sep">–</span>
            <input type="number" class="range-input" id="cmax" placeholder="max" />
            <button class="range-btn" id="cbar-apply">应用</button>
          </div>
          <div class="dual-range-wrap" id="cbar-dual-wrap">
            <div class="dual-range-track"><div class="dual-range-fill" id="cbar-dual-fill"></div></div>
            <div class="dual-range-thumb" id="cbar-thumb-min"></div>
            <div class="dual-range-thumb" id="cbar-thumb-max"></div>
          </div>
        </div>

        <div class="side-card" data-section="palette">
          <div class="cbar-colorscale-row">
            <span class="range-label">预设</span>
            <select id="colorscale-select" class="colorscale-select"></select>
          </div>
        </div>

        <div class="side-card" data-section="vectors">
          <div id="quiver-density-row" class="hidden" style="margin-top:10px">
            <div style="display:flex;align-items:center;gap:8px">
              <span class="range-label">矢量密度</span>
              <input type="range" id="quiver-step" min="10" max="40" value="20" class="depth-slider" style="flex:1" />
              <span class="range-label">步长</span>
              <input type="number" id="quiver-step-input" min="1" max="40" value="20" step="1" class="range-input quiver-step-input" />
            </div>
            <div id="quiver-effective-info" class="quiver-effective-info"></div>
          </div>
        </div>

        <div class="side-card" id="timeline-card" data-section="timeline" style="display:none">
          <div class="side-card-title">时间</div>
          <select class="depth-select" id="date-select"></select>
          <div class="depth-info">
            <span id="date-index">第 1 帧</span>
            <span id="date-total">共 -- 帧</span>
          </div>
          <div class="depth-slider-wrap">
            <input type="range" class="depth-slider" id="date-slider" min="0" max="0" value="0" />
          </div>
          <div class="timeline-controls">
            <button id="play-btn" class="play-btn">▶ 播放</button>
            <span id="play-status" class="play-status"></span>
          </div>
          <div style="display:flex;align-items:center;gap:8px;margin-top:8px">
            <span class="range-label">间隔</span>
            <input type="number" id="play-interval" min="1" max="60" value="3" step="1" class="range-input" style="width:4.5ch" />
            <span class="range-label">s</span>
          </div>
        </div>

        <div class="side-card" data-section="depth">
          <div class="side-card-title">深度</div>
          <select class="depth-select" id="depth-select"></select>
          <div class="depth-info">
            <span id="depth-index">第 -- 层</span>
            <span id="depth-total">共 -- 层</span>
          </div>
          <div class="depth-slider-wrap">
            <input type="range" class="depth-slider" id="depth-slider" min="0" max="19" value="0" />
          </div>
        </div>

        <div class="side-card" data-section="layer-visibility">
          <div class="var-group" style="margin-top:10px" id="layer-vis-group">
            <div class="var-group-header" data-group="layer-vis">
              <span class="var-group-arrow">▶</span>
              <span>3D 显示层</span>
            </div>
            <div class="var-group-body hidden" id="var-group-layer-vis">
              <div style="display:flex;gap:6px;margin-bottom:8px">
                <button class="range-btn" id="layer-vis-all">全选</button>
                <button class="range-btn" id="layer-vis-none">全不选</button>
                <button class="range-btn" id="layer-vis-even">隔层</button>
                <button class="range-btn" style="margin-left:auto" id="layer-vis-apply">应用</button>
              </div>
              <div id="layer-vis-checks" style="display:flex;flex-direction:column;gap:4px;min-height:80px;max-height:400px;height:200px;overflow-y:auto;resize:vertical"></div>
            </div>
          </div>
        </div>

        <div class="side-card" data-section="selection">
          <div class="side-card-title">区域信息</div>
          <div class="region-grid">
            <label>最小经度<input id="region-lon-min" type="number" step="0.0001" /></label>
            <label>最大经度<input id="region-lon-max" type="number" step="0.0001" /></label>
            <label>最小纬度<input id="region-lat-min" type="number" step="0.0001" /></label>
            <label>最大纬度<input id="region-lat-max" type="number" step="0.0001" /></label>
          </div>
          <div class="region-actions">
            <button class="range-btn" id="region-select-map">在图上框选</button>
            <button class="range-btn" id="region-apply">应用区域</button>
            <button class="range-btn" id="region-clear">恢复全域</button>
          </div>
          <div id="region-status" class="region-status">当前使用完整数据区域</div>
          <div class="click-info-card empty" id="map-click-info">区域内尚未选择分析点</div>
        </div>

        <button class="clear-btn" id="clear-btn">🗑️ 清除选点</button>

      </div><!-- end sidebar -->
      <div id="sidebar-backdrop" class="sidebar-backdrop"></div>
      <div class="resizer" id="sidebar-resizer"></div>

      <!-- 右侧图表区 -->
      <div class="charts-col">
        <div id="workspace-empty" class="workspace-empty">
          <div class="workspace-empty-icon">🌊</div>
          <div class="workspace-empty-title">选择 NetCDF 数据开始分析</div>
          <div class="workspace-empty-text">
            A 选择一个文件为单帧，选择多个文件为时间序列；再选择 B 则进行双序列对比。
          </div>
        </div>

        <div class="top-panels" id="top-panels">
          <section class="panel visualization-slot" id="slot-left">
            <div class="panel-header slot-header">
              <span class="panel-title slot-title">三维场</span>
              <span class="panel-hint slot-source">数据来源：当前数据</span>
              <select class="slot-view-select" aria-label="左窗口视图"></select>
              <button type="button" class="slot-open-other hidden"></button>
              <button type="button" class="slot-close" title="关闭左窗口" aria-label="关闭左窗口">×</button>
              <span class="loading-indicator hidden slot-loading">正在加载…</span>
            </div>
            <div class="slot-error hidden"></div>
            <div id="slot-left-graph" class="graph-container slot-graph"></div>
          </section>
          <div class="resizer" id="column-resizer"></div>
          <section class="panel visualization-slot" id="slot-right">
            <div class="panel-header slot-header">
              <span class="panel-title slot-title">水平切层</span>
              <span class="panel-hint slot-source">数据来源：当前数据</span>
              <select class="slot-view-select" aria-label="右窗口视图"></select>
              <button type="button" class="slot-open-other hidden"></button>
              <button type="button" class="slot-close" title="关闭右窗口" aria-label="关闭右窗口">×</button>
              <span class="loading-indicator hidden slot-loading">正在加载…</span>
            </div>
            <div class="slot-error hidden"></div>
            <div id="slot-right-graph" class="graph-container slot-graph"></div>
          </section>
        </div>

        <div class="row-resizer" id="row-resizer"></div>
        <section class="panel panel-profile" id="analysis-panel">
          <div class="profile-header">
            <div class="analysis-title-group">
              <span id="profile-panel-title" class="panel-hint"></span>
              <span id="analysis-source-badge" class="analysis-source-badge hidden"></span>
            </div>
            <div class="analysis-tabs" aria-label="分析模式">
              <button id="analysis-tab-point" class="analysis-tab active">单点垂直剖面</button>
              <button id="analysis-tab-transect" class="analysis-tab">两点垂直断面</button>
            </div>
            <div class="range-controls">
              <span class="range-label">深度</span>
              <input type="number" id="depth-min" class="range-input" placeholder="min" step="10" />
              <span class="range-sep">–</span>
              <input type="number" id="depth-max" class="range-input" placeholder="max" step="10" />
              <span class="range-unit">m</span>
              <div class="dual-range-wrap analysis-range-slider" id="depth-dual-wrap">
                <div class="dual-range-track"><div class="dual-range-fill" id="depth-dual-fill"></div></div>
                <div class="dual-range-thumb" id="depth-thumb-min"></div>
                <div class="dual-range-thumb" id="depth-thumb-max"></div>
              </div>
              <span class="range-divider" id="value-range-divider"></span>
              <span class="range-label" id="value-range-label">值</span>
              <input type="number" id="speed-min" class="range-input" placeholder="min" step="1" />
              <span class="range-sep" id="value-range-sep">–</span>
              <input type="number" id="speed-max" class="range-input" placeholder="max" step="1" />
              <span class="range-unit" id="value-range-unit">m/s</span>
              <div class="dual-range-wrap analysis-range-slider" id="value-dual-wrap">
                <div class="dual-range-track"><div class="dual-range-fill" id="value-dual-fill"></div></div>
                <div class="dual-range-thumb" id="value-thumb-min"></div>
                <div class="dual-range-thumb" id="value-thumb-max"></div>
              </div>
              <button id="range-apply-btn" class="range-btn">应用</button>
            </div>
            <span class="loading-indicator hidden" id="profile-loading">计算中…</span>
            <button type="button" id="analysis-collapse" class="analysis-collapse" aria-expanded="true">收起</button>
          </div>
          <div id="analysis-unavailable" class="analysis-unavailable hidden">当前没有可用于选点的二维窗口</div>
          <div id="profile-graph" class="graph-container"></div>
        </section>

      </div><!-- end charts-col -->
    </div><!-- end body-row -->
  </div>

  <script src="/static/js/core/session-store.js?v=4"><\/script>
  <script src="/static/js/core/panel-registry.js?v=4"><\/script>
  <script src="/static/js/core/variable-registry.js?v=1"><\/script>
  <script src="/static/js/core/api-client.js?v=1"><\/script>
  <script src="/static/js/core/playback-cache.js?v=1"><\/script>
  <script src="/static/js/core/plotly-config.js?v=1"><\/script>
  <script src="/static/js/core/ui-events.js?v=2"><\/script>
  <script src="/static/js/components/dual-range.js?v=1"><\/script>
  <script src="/static/js/components/timeline.js?v=4"><\/script>
  <script src="/static/js/components/panel-resizer.js?v=1"><\/script>
  <script src="/static/js/components/panel-slot.js?v=2"><\/script>
  <script src="/static/js/components/sidebar-controller.js?v=5"><\/script>
  <script src="/static/js/components/sidebar-sections.js?v=5"><\/script>
  <script src="/static/js/features/controls/region-controls.js?v=4"><\/script>
  <script src="/static/js/interactions/map-selection.js?v=1"><\/script>
  <script src="/static/js/features/dataset/upload-controller.js?v=5"><\/script>
  <script src="/static/js/features/controls/range-controls.js?v=5"><\/script>
  <script src="/static/js/features/controls/layer-visibility-controls.js?v=3"><\/script>
  <script src="/static/js/features/controls/variable-controls.js?v=5"><\/script>
  <script src="/static/js/features/controls/visualization-controls.js?v=1"><\/script>
  <script src="/static/js/features/controls/analysis-controls.js?v=3"><\/script>
  <script src="/static/js/features/workspace/controller.js?v=6"><\/script>
  <script src="/static/js/features/comparison/view.js?v=7"><\/script>
  <script src="/static/js/features/volume/view.js?v=6"><\/script>
  <script src="/static/js/features/layer/view.js?v=4"><\/script>
  <script src="/static/js/features/profile/view.js?v=4"><\/script>
  <script src="/static/js/features/transect/view.js?v=4"><\/script>
  <script src="/static/js/features/workspace/panel-controller.js?v=6"><\/script>
  <script src="/static/app.js?v=31"><\/script>
</body>
</html>
`,Z={key:0,class:"header-panel-switcher","aria-label":"当前编辑窗口"},ee={class:"header-panel-options"},ae=["aria-pressed","title","onClick"],se={key:0},te=["disabled","aria-label","title","onClick"],ne=["aria-pressed","title"],ie={key:0},le={key:0,class:"header-link-notice"},Ae=F({__name:"ExplorerPanelSwitcher",setup(r){const e=E({ready:!1,active:"right",linked3d2d:!1,linkedNotice:"",panels:{left:{enabled:!0,viewLabel:"水平切层",sourceLabel:"当前数据",variableLabel:""},right:{enabled:!0,viewLabel:"水平切层",sourceLabel:"当前数据",variableLabel:""}}}),o=C(()=>["left","right"].filter(c=>e.panels[c].enabled));function l(c){return c==="left"?"左窗口":"右窗口"}function u(c){const p=e.panels[c];return p.enabled?`${l(c)} · ${p.viewLabel} · ${p.sourceLabel}${p.variableLabel?` · ${p.variableLabel}`:""}`:`打开${l(c)}`}function y(c,p){document.dispatchEvent(new CustomEvent("pisces:panel-command",{detail:{action:c,slotId:p}}))}function v(c){y(e.panels[c].enabled?"activate":"open",c)}function a(c){y("close",c)}function g(c){e.ready=c.detail?.ready===!0}function x(c){const p=c.detail||{};p.active&&(e.active=p.active),typeof p.linked3d2d=="boolean"&&(e.linked3d2d=p.linked3d2d),["left","right"].forEach(d=>{p.panels?.[d]&&Object.assign(e.panels[d],p.panels[d])})}let f;function _(c){e.linkedNotice=c.detail?.message||"",window.clearTimeout(f),f=window.setTimeout(()=>{e.linkedNotice=""},3500)}return O(()=>{document.addEventListener("pisces:workspace-state",g),document.addEventListener("pisces:panel-state",x),document.addEventListener("pisces:linked-notice",_)}),U(()=>{document.removeEventListener("pisces:workspace-state",g),document.removeEventListener("pisces:panel-state",x),document.removeEventListener("pisces:linked-notice",_),window.clearTimeout(f)}),(c,p)=>e.ready&&o.value.length?(b(),m("div",Z,[p[2]||(p[2]=i("span",{class:"header-panel-switcher-label"},"当前编辑窗口",-1)),i("div",ee,[(b(),m(B,null,N(["left","right"],d=>i("div",{key:d,class:T(["header-panel-option",{active:e.panels[d].enabled&&e.active===d,closed:!e.panels[d].enabled}])},[i("button",{class:"header-panel-select",type:"button","aria-pressed":e.panels[d].enabled&&e.active===d,title:u(d),onClick:$=>v(d)},[i("strong",null,h(e.panels[d].enabled?l(d):`＋ 打开${l(d)}`),1),e.panels[d].enabled?(b(),m("small",se,h(e.panels[d].sourceLabel),1)):j("",!0)],8,ae),e.panels[d].enabled&&o.value.length>1?(b(),m("button",{key:0,class:"header-panel-close",type:"button",disabled:e.linked3d2d,"aria-label":`关闭${l(d)}`,title:e.linked3d2d?"请先退出 3D/2D 联动":`关闭${l(d)}`,onClick:$=>a(d)},"×",8,te)):j("",!0)],2)),64))]),i("button",{class:T(["header-link-toggle",{active:e.linked3d2d}]),type:"button","aria-pressed":e.linked3d2d,title:e.linked3d2d?"退出 3D/2D 联动并恢复原窗口":"左侧三维场与右侧水平切层联动",onClick:p[0]||(p[0]=d=>y("toggle-3d2d"))},[p[1]||(p[1]=J(" 3D/2D ",-1)),e.linked3d2d?(b(),m("small",ie,"联动中")):j("",!0)],10,ne),e.linkedNotice?(b(),m("span",le,h(e.linkedNotice),1)):j("",!0)])):j("",!0)}}),de=["/static/js/core/session-store.js?v=3","/static/js/core/panel-registry.js?v=3","/static/js/core/variable-registry.js?v=1","/static/js/core/api-client.js?v=1","/static/js/core/playback-cache.js?v=1","/static/js/core/plotly-config.js?v=1","/static/js/core/ui-events.js?v=1","/static/js/components/dual-range.js?v=1","/static/js/components/timeline.js?v=4","/static/js/components/panel-resizer.js?v=1","/static/js/components/panel-slot.js?v=2","/static/js/components/sidebar-controller.js?v=5","/static/js/components/sidebar-sections.js?v=5","/static/js/features/controls/region-controls.js?v=3","/static/js/interactions/map-selection.js?v=1","/static/js/features/dataset/upload-controller.js?v=5","/static/js/features/controls/range-controls.js?v=4","/static/js/features/controls/layer-visibility-controls.js?v=3","/static/js/features/controls/variable-controls.js?v=4","/static/js/features/controls/visualization-controls.js?v=1","/static/js/features/controls/analysis-controls.js?v=3","/static/js/features/workspace/controller.js?v=6","/static/js/features/comparison/view.js?v=7","/static/js/features/volume/view.js?v=6","/static/js/features/layer/view.js?v=4","/static/js/features/profile/view.js?v=4","/static/js/features/transect/view.js?v=4","/static/js/features/workspace/panel-controller.js?v=5","/static/app.js?v=30"];function re(r){return new Promise((e,o)=>{const l=document.querySelector(`script[data-explorer-runtime="${r}"]`);if(l?.dataset.loaded==="true"){e();return}const u=l||document.createElement("script");u.src=r,u.dataset.explorerRuntime=r,u.onload=()=>{u.dataset.loaded="true",e()},u.onerror=()=>o(new Error(`无法加载 Explorer 模块：${r}`)),l||document.body.appendChild(u)})}async function Re(){for(const r of de)await re(r)}function Me(){document.querySelectorAll("#slot-left-graph, #slot-right-graph, #profile-graph").forEach(r=>Plotly.purge(r))}const ce={id:"explorer-vue-sidebar",class:"explorer-sidebar-tool"},oe={class:"sidebar-tool-main glass-surface"},ve={class:"sidebar-tool-topline"},pe=["aria-expanded","title"],ue={class:"sidebar-data-copy"},be={class:"sidebar-data-action"},me={viewBox:"0 0 24 24"},he=["href"],ge={key:0,class:"sidebar-panel-context sidebar-panel-context-summary"},ye={class:"sidebar-panel-current"},fe={class:"sidebar-control-summary"},we=["title"],je={class:"sidebar-tool-rail","aria-label":"侧栏功能导航"},ke={viewBox:"0 0 24 24"},Le=["href"],xe=["disabled"],_e={viewBox:"0 0 24 24"},Ee=["href"],Ce=["aria-expanded","disabled","onClick"],$e={class:"sidebar-module-icon"},Se={viewBox:"0 0 24 24"},De=["href"],Be={class:"sidebar-module-title"},D="pisces.sidebar.modules.v1",M="pisces.sidebar.collapsed",Ne="pisces.sidebar.width.v2",Te=F({__name:"ExplorerSidebar",setup(r){const e=[{key:"variables",label:"视图与变量",icon:"variables"},{key:"timeline",label:"时间",icon:"timeline"},{key:"depth",label:"深度",icon:"depth"},{key:"colorRange",label:"颜色范围",icon:"colors"},{key:"palette",label:"配色",icon:"colors"},{key:"vectors",label:"矢量密度",icon:"variables"},{key:"volumeLayers",label:"3D 显示层",icon:"depth"},{key:"region",label:"区域与选点",icon:"selection"}],o=R("data"),l=R(!1),u=new Set;let y;const v=E({ready:!1,label:"未加载数据",mode:""}),a=E({active:"right",enabled:{left:!0,right:!0},sourceLabel:"当前数据",viewLabel:"水平切层",variableLabel:"流速（合成）",depthLabel:"第 -- 层",dateLabel:"当前帧",colorLabel:"自动范围",paletteLabel:"",quiverLabel:"自动密度",layerCountLabel:"默认层",analysisLabel:"单点剖面",regionLabel:"完整区域",pointCount:0,showTimeline:!1,showDepth:!0,showVectors:!1,showVolumeLayers:!1,showAnalysis:!0,canSelectRegion:!0}),g=E({variables:!0,timeline:!1,depth:!1,colorRange:!1,palette:!1,vectors:!1,volumeLayers:!1,region:!1}),x=C(()=>`${a.viewLabel} · ${a.variableLabel}`),f=C(()=>v.ready?o.value==="data"?"返回控制":"管理数据":"选择数据"),_=C(()=>[{label:"视图",value:a.viewLabel},{label:"变量",value:a.variableLabel},{label:"时间",value:a.showTimeline?a.dateLabel:""},{label:"深度",value:a.showDepth?a.depthLabel:""},{label:"范围",value:a.colorLabel},{label:"配色",value:a.paletteLabel},{label:"矢量",value:a.showVectors?a.quiverLabel:""},{label:"3D 层",value:a.showVolumeLayers?a.layerCountLabel:""},{label:"区域",value:a.regionLabel},{label:"分析",value:a.showAnalysis?a.analysisLabel:""}]);function c(t){return`/static/assets/icons/sidebar-icons.svg?v=1#${t}`}function p(t){const n={timeline:"单帧数据，无时间轴",depth:"表面变量，无深度维度",vectors:"当前变量不是矢量场",volumeLayers:"请先切换到三维场"};return d(t)?{variables:x.value,timeline:a.dateLabel,depth:a.depthLabel,colorRange:a.colorLabel,palette:a.paletteLabel||"颜色方案",vectors:a.quiverLabel,volumeLayers:a.layerCountLabel,region:a.canSelectRegion?a.regionLabel:"当前视图不支持地图框选"}[t]:n[t]||"当前不可用"}function d(t){return{timeline:a.showTimeline,depth:a.showDepth,vectors:a.showVectors,volumeLayers:a.showVolumeLayers}[t]??!0}function $(){localStorage.setItem(D,JSON.stringify(g))}function k(){document.getElementById("sidebar-data-pane")?.classList.toggle("vue-section-hidden",o.value!=="data"),document.getElementById("sidebar-control-pane")?.classList.toggle("vue-section-hidden",!v.ready||o.value!=="controls"),e.forEach(n=>{const s=document.getElementById(`sidebar-module-${n.key}`);s?.classList.toggle("module-collapsed",!g[n.key]),s?.classList.toggle("module-unavailable",!d(n.key))});const t=document.getElementById("clear-btn");t&&(t.disabled=a.pointCount===0)}function L(t){!v.ready&&t==="controls"||(o.value=t,k())}function Y(){if(!v.ready){L("data");return}L(o.value==="data"?"controls":"data")}function K(t){g[t]=!g[t],u.add(t),$(),k()}function w(t,n=!0){l.value=t;const s=document.querySelector(".sidebar");if(s?.classList.toggle("collapsed",t),s){const S=Number(localStorage.getItem(Ne)),A=Number.isFinite(S)?Math.max(280,Math.min(380,S)):304;s.style.width=`${t?52:A}px`,s.style.minWidth=`${t?52:280}px`,s.style.flexBasis=`${t?52:A}px`}document.getElementById("main-screen")?.classList.toggle("sidebar-collapsed",t),n&&window.innerWidth>760&&localStorage.setItem(M,t?"1":"0"),document.dispatchEvent(new CustomEvent("pisces:sidebar-toggle",{detail:{collapsed:t}})),window.clearTimeout(y),y=window.setTimeout(()=>{typeof PanelSlot<"u"&&PanelSlot.resizeVisible?.()},80)}function z(t){L(t),w(!1)}function q(t){const n=t.detail||{},s=v.ready;v.ready=n.ready===!0,v.label=n.label||(v.ready?"当前数据":"未加载数据"),v.mode=n.mode||"",v.ready?(!s||o.value==="data")&&L("controls"):L("data"),k()}function I(t){const n=t.detail||{};n.active&&(a.active=n.active),n.enabled&&(a.enabled=n.enabled),["sourceLabel","viewLabel","variableLabel","depthLabel","dateLabel","colorLabel","paletteLabel","quiverLabel","layerCountLabel","analysisLabel","regionLabel"].forEach(s=>{typeof n[s]=="string"&&(a[s]=n[s])}),["showTimeline","showDepth","showVectors","showVolumeLayers","showAnalysis","canSelectRegion"].forEach(s=>{typeof n[s]=="boolean"&&(a[s]=n[s])}),a.showTimeline&&!u.has("timeline")&&(g.timeline=!0),a.showDepth&&!u.has("depth")&&(g.depth=!0),a.pointCount=Number(n.pointCount||0),k()}function V(){window.innerWidth<=760&&!l.value&&w(!0,!1)}function P(){w(!0,!1)}return O(async()=>{try{const n=JSON.parse(localStorage.getItem(D)||"{}");e.forEach(s=>{typeof n[s.key]=="boolean"&&(g[s.key]=n[s.key],u.add(s.key))})}catch{localStorage.removeItem(D)}l.value=window.innerWidth<=760||localStorage.getItem(M)==="1",w(l.value,!1),document.addEventListener("pisces:workspace-state",q),document.addEventListener("pisces:panel-state",I),document.getElementById("sidebar-backdrop")?.addEventListener("click",P);const t=document.getElementById("sidebar-toggle");t&&(t.onclick=()=>w(!l.value)),window.addEventListener("resize",V),await G(),k()}),U(()=>{document.removeEventListener("pisces:workspace-state",q),document.removeEventListener("pisces:panel-state",I),document.getElementById("sidebar-backdrop")?.removeEventListener("click",P),window.removeEventListener("resize",V),window.clearTimeout(y)}),(t,n)=>(b(),m("div",ce,[i("div",oe,[i("div",ve,[i("button",{class:"sidebar-data-status",type:"button","aria-expanded":o.value==="data",title:f.value,onClick:Y},[i("span",{class:T(["sidebar-data-dot",{ready:v.ready}])},null,2),i("span",ue,[i("strong",null,h(v.label),1),i("small",null,h(v.mode||(v.ready?"数据已就绪":"点击选择 NetCDF")),1)]),i("span",be,h(f.value),1)],8,pe),i("button",{class:"sidebar-collapse-button",type:"button","aria-label":"收起侧栏",onClick:n[0]||(n[0]=s=>w(!0))},[(b(),m("svg",me,[i("use",{href:c("collapse")},null,8,he)]))])]),v.ready&&o.value==="controls"?(b(),m("div",ge,[i("div",ye,[i("span",null,"当前控制："+h(a.active==="left"?"左窗口":"右窗口"),1),i("strong",null,"· "+h(a.sourceLabel||"—"),1)]),i("dl",fe,[(b(!0),m(B,null,N(_.value,s=>(b(),m("div",{key:s.label},[i("dt",null,h(s.label),1),i("dd",{title:s.value||"—"},h(s.value||"—"),9,we)]))),128))])])):j("",!0)]),i("div",je,[i("button",{type:"button",title:"数据",onClick:n[1]||(n[1]=s=>z("data"))},[(b(),m("svg",ke,[i("use",{href:c("data")},null,8,Le)]))]),i("button",{type:"button",title:"控制面板",disabled:!v.ready,onClick:n[2]||(n[2]=s=>z("controls"))},[(b(),m("svg",_e,[i("use",{href:c("variables")},null,8,Ee)]))],8,xe)]),(b(),m(B,null,N(e,s=>H(Q,{key:s.key,to:`#sidebar-module-header-${s.key}`},[i("button",{class:"sidebar-module-toggle",type:"button","aria-expanded":d(s.key)&&g[s.key],disabled:!d(s.key),onClick:S=>K(s.key)},[i("span",$e,[(b(),m("svg",Se,[i("use",{href:c(s.icon)},null,8,De)]))]),i("span",Be,[i("strong",null,h(s.label),1),i("small",null,h(p(s.key)),1)]),n[3]||(n[3]=i("span",{class:"sidebar-module-chevron"},"⌄",-1))],8,Ce)],8,["to"])),64))]))}}),ze=[{key:"variables",cards:["variables"]},{key:"timeline",cards:["timeline"]},{key:"depth",cards:["depth"]},{key:"colorRange",cards:["color-range"]},{key:"palette",cards:["palette"]},{key:"vectors",cards:["vectors"]},{key:"volumeLayers",cards:["layer-visibility"]},{key:"region",cards:["selection"]}];function W(r,e){return r.querySelector(`:scope > [data-section="${e}"]`)}function qe(r){const e=document.createElement("section");e.id=`sidebar-module-${r}`,e.className="sidebar-module-shell";const o=document.createElement("div");o.id=`sidebar-module-header-${r}`,o.className="sidebar-module-header";const l=document.createElement("div");return l.className="sidebar-module-body",e.append(o,l),{shell:e,body:l}}function Ie(r){r.querySelectorAll(":scope > .sidebar-control-pane, :scope > .sidebar-primary-pane, :scope > .sidebar-data-pane, :scope > #sidebar-primary-nav").forEach(l=>l.remove());const e=document.createElement("div");e.id="sidebar-data-pane",e.className="sidebar-data-pane",["data","overview","comparison-files"].forEach(l=>{const u=W(r,l);u&&e.appendChild(u)}),r.appendChild(e);const o=document.createElement("div");o.id="sidebar-control-pane",o.className="sidebar-control-pane",ze.forEach(l=>{const{shell:u,body:y}=qe(l.key);if(l.cards.forEach(v=>{const a=W(r,v);a&&y.appendChild(a)}),l.key==="region"){const v=r.querySelector(":scope > #clear-btn");v&&y.appendChild(v)}o.appendChild(u)}),r.appendChild(o)}function We(){const r=document.querySelector(".sidebar"),e=document.getElementById("sidebar-vue-context");if(!r||!e)return null;Ie(r),r.querySelector(".sidebar-brand")?.remove();const o=X(Te);return o.mount(e),o}export{Ae as _,Pe as l,We as m,Me as p,Re as s};
