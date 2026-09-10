import unittest
import xml.etree.ElementTree as ET
from pathlib import Path


class FrontendWorkspaceTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.root = Path(__file__).resolve().parents[1]
        cls.index = (
            cls.root / "frontend/pages/index.html"
        ).read_text(encoding="utf-8")
        cls.registry = (
            cls.root / "frontend/js/core/panel-registry.js"
        ).read_text(encoding="utf-8")
        cls.controller = (
            cls.root / "frontend/js/features/workspace/panel-controller.js"
        ).read_text(encoding="utf-8")
        cls.upload_controller = (
            cls.root / "frontend/js/features/dataset/upload-controller.js"
        ).read_text(encoding="utf-8")

    def test_workspace_uses_two_reusable_slots(self):
        self.assertIn('id="slot-left"', self.index)
        self.assertIn('id="slot-right"', self.index)
        self.assertIn('id="analysis-panel"', self.index)
        self.assertEqual(self.index.count('class="slot-close"'), 2)
        self.assertEqual(self.index.count('class="slot-open-other hidden"'), 2)
        self.assertIn('id="analysis-collapse"', self.index)
        self.assertNotIn('id="activate-left-panel"', self.index)
        self.assertNotIn('id="activate-right-panel"', self.index)
        for removed_id in (
            'id="main-row"',
            'id="comparison-row"',
            'id="vol-graph"',
            'id="layer-map-graph"',
            'id="compare-a-graph"',
            'id="compare-b-graph"',
            'id="compare-diff-graph"',
        ):
            self.assertNotIn(removed_id, self.index)

    def test_data_modes_share_one_main_screen_entry(self):
        self.assertIn('id="dataset-a-input"', self.index)
        self.assertIn('id="dataset-b-input"', self.index)
        self.assertIn('id="load-data-btn"', self.index)
        self.assertIn('id="workspace-empty"', self.index)
        for removed_id in (
            'id="upload-screen"',
            'id="mode-single-btn"',
            'id="mode-series-btn"',
            'id="mode-compare-btn"',
            'id="drop-zone"',
        ):
            self.assertNotIn(removed_id, self.index)

    def test_data_loader_uses_progressive_disclosure(self):
        self.assertIn('id="add-dataset-b"', self.index)
        self.assertIn('id="dataset-b-section"', self.index)
        self.assertIn('id="remove-dataset-b"', self.index)
        self.assertIn('id="dataset-a-summary"', self.index)
        self.assertIn('id="dataset-b-summary"', self.index)
        self.assertIn('class="dataset-select-block hidden"', self.index)
        self.assertNotIn('id="detected-load-mode"', self.index)
        self.assertIn('buttonLabel: "加载单帧数据"', self.upload_controller)
        self.assertIn('buttonLabel: "开始 A/B 对比"', self.upload_controller)
        self.assertIn("setBExpanded(false)", self.upload_controller)
        self.assertIn("selected.length <= 1", self.upload_controller)
        for element_id in (
            "current-session-summary", "current-dataset-a",
            "current-dataset-b", "replace-data-btn", "cancel-replace-btn",
        ):
            self.assertIn(f'id="{element_id}"', self.index)
        self.assertIn('ApiClient.fetchJson("/api/status")', self.upload_controller)
        self.assertIn('ApiClient.fetchJson("/api/session", { method: "DELETE" })', self.upload_controller)
        self.assertIn("restoreSession", self.upload_controller)
        self.assertIn("文件信息不可用，请重新加载数据", self.upload_controller)
        self.assertIn('id === "current-dataset-a"', self.upload_controller)

    def test_palette_selection_rerenders_without_range_apply(self):
        controls = (
            self.root / "frontend/js/features/controls/range-controls.js"
        ).read_text(encoding="utf-8")
        self.assertIn('colorscaleSelect.addEventListener("change"', controls)
        self.assertIn("await renderLayer(state.depthIdx, state.points);", controls)

    def test_volume_depth_selection_does_not_rerender_volume(self):
        app = (self.root / "frontend/app.js").read_text(encoding="utf-8")
        guard = "if (PanelRegistry.definitions[activeView]?.volume) return;"
        self.assertIn(guard, app)
        self.assertLess(app.index(guard), app.index("await Promise.all([", app.index(guard)))

    def test_3d_2d_linked_mode_keeps_depth_updates_on_right_panel(self):
        app = (self.root / "frontend/app.js").read_text(encoding="utf-8")
        session_store = (
            self.root / "frontend/js/core/session-store.js"
        ).read_text(encoding="utf-8")
        switcher = (
            self.root / "frontend/vue-app/src/explorer/ExplorerPanelSwitcher.vue"
        ).read_text(encoding="utf-8")
        self.assertIn('action === "toggle-3d2d"', self.controller)
        self.assertIn('await PanelController.renderSlot("right");', app)
        self.assertIn('SessionStore.syncLinked(depthSource, ["depthIdx"])', app)
        self.assertIn("function beginLinked", session_store)
        self.assertIn("function endLinked", session_store)
        self.assertIn("linked_snapshot", session_store)
        self.assertIn("3D/2D", switcher)
        self.assertIn("state.linked3d2d", switcher)

    def test_linked_views_pair_volume_and_layer_by_source(self):
        self.assertIn('return volume ? "volume3d" : "layer2d"', self.controller)
        self.assertIn("comparisonVolume", self.controller)
        self.assertIn("alignLinkedViews(comparisonSource)", self.controller)
        self.assertIn("if (state.linked3d2d) return;", self.controller)

    def test_single_a_b_files_enable_comparison_without_playback(self):
        self.assertIn(
            "selectedA.length === 1 && selectedB.length === 1",
            self.upload_controller,
        )

    def test_region_controls_support_map_and_numeric_selection(self):
        for element_id in (
            "region-lon-min", "region-lon-max",
            "region-lat-min", "region-lat-max",
            "region-select-map", "region-apply", "region-clear",
        ):
            self.assertIn(f'id="{element_id}"', self.index)
        region_controls = (
            self.root / "frontend/js/features/controls/region-controls.js"
        ).read_text(encoding="utf-8")
        self.assertIn("keepPointsInside", region_controls)
        self.assertIn('params.set("region"', region_controls)
        self.assertIn("restoreSavedRegion", region_controls)
        self.assertIn("RangeControls.save", region_controls)
        map_selection = (
            self.root / "frontend/js/interactions/map-selection.js"
        ).read_text(encoding="utf-8")
        self.assertIn('"plotly_selected"', map_selection)
        self.assertIn('dragmode: "select"', map_selection)

    def test_map_selection_accepts_valid_overlay_coordinates(self):
        map_selection = (
            self.root / "frontend/js/interactions/map-selection.js"
        ).read_text(encoding="utf-8")
        self.assertNotIn("point.curveNumber >= 1", map_selection)
        self.assertIn("Number.isFinite(lon)", map_selection)
        self.assertIn('role === "selection-points"', map_selection)
        self.assertIn('querySelector(".slot-header").onmousedown', self.controller)
        self.assertNotIn("slot.root.onmousedown", self.controller)

    def test_quiver_slider_and_numeric_input_have_distinct_minima(self):
        self.assertIn(
            'id="quiver-step" min="10" max="40"',
            self.index,
        )
        self.assertIn(
            'id="quiver-step-input" min="1" max="40"',
            self.index,
        )
        self.assertIn(
            "TimelineController.setup(\n      state.isSeries ? state.dates : []",
            (
                self.root / "frontend/js/features/workspace/controller.js"
            ).read_text(encoding="utf-8"),
        )

    def test_sidebar_is_collapsible_without_replacing_workspace(self):
        self.assertIn('id="sidebar-toggle"', self.index)
        self.assertIn('id="sidebar-rail-nav"', self.index)
        self.assertIn('id="sidebar-backdrop"', self.index)
        self.assertIn(
            "/static/js/components/sidebar-controller.js",
            self.index,
        )
        self.assertIn(
            "/static/js/components/sidebar-sections.js",
            self.index,
        )
        icon_path = (
            self.root / "frontend/assets/icons/sidebar-icons.svg"
        )
        self.assertTrue(icon_path.is_file())
        icon_root = ET.parse(icon_path).getroot()
        icon_ids = {
            element.attrib["id"]
            for element in icon_root
            if element.tag.endswith("symbol")
        }
        self.assertTrue({
            "menu", "collapse", "data", "overview", "comparison",
            "variables", "colors", "timeline", "depth", "analysis",
            "selection",
        }.issubset(icon_ids))
        sidebar_sections = (
            self.root / "frontend/js/components/sidebar-sections.js"
        ).read_text(encoding="utf-8")
        sidebar_controller = (
            self.root / "frontend/js/components/sidebar-controller.js"
        ).read_text(encoding="utf-8")
        self.assertIn(
            "toggle.style.top = `${rectangle.top + 20}px`",
            sidebar_controller,
        )
        self.assertIn("rail-flyout-open", sidebar_sections)
        self.assertIn('event.key === "Escape"', sidebar_sections)
        for section in (
            "data",
            "overview",
            "variables",
            "color-range",
            "palette",
            "vectors",
            "timeline",
            "depth",
            "layer-visibility",
            "selection",
        ):
            self.assertIn(f'data-section="{section}"', self.index)

    def test_vue_sidebar_exposes_panel_context_and_flat_control_flow(self):
        sidebar = (
            self.root / "frontend/vue-app/src/explorer/ExplorerSidebar.vue"
        ).read_text(encoding="utf-8")
        layout = (
            self.root / "frontend/vue-app/src/explorer/sidebar-layout.ts"
        ).read_text(encoding="utf-8")
        ui_events = (
            self.root / "frontend/js/core/ui-events.js"
        ).read_text(encoding="utf-8")
        app_header = (
            self.root / "frontend/vue-app/src/components/AppHeader.vue"
        ).read_text(encoding="utf-8")
        explorer_app = (
            self.root / "frontend/vue-app/src/explorer/App.vue"
        ).read_text(encoding="utf-8")
        switcher = (
            self.root / "frontend/vue-app/src/explorer/ExplorerPanelSwitcher.vue"
        ).read_text(encoding="utf-8")
        self.assertIn("sidebar-panel-context", sidebar)
        self.assertIn("当前控制：", sidebar)
        self.assertIn('class="sidebar-control-summary"', sidebar)
        for label in ("视图", "变量", "时间", "深度", "范围", "配色", "矢量", "3D 层", "区域", "分析"):
            self.assertIn(f'label: "{label}"', sidebar)
        self.assertIn('item.value || "—"', sidebar)
        for action in ("选择数据", "管理数据", "返回控制"):
            self.assertIn(action, sidebar)
        self.assertNotIn("sidebar-panel-tabs", sidebar)
        self.assertIn('cards: ["variables"]', layout)
        self.assertIn('cards: ["selection"]', layout)
        self.assertIn('pane.id = "sidebar-control-pane"', layout)
        self.assertNotIn('class="sidebar-primary-tabs glass-surface"', sidebar)
        self.assertIn('v-for="item in modules"', sidebar)
        self.assertIn("toggleDataView", sidebar)
        self.assertNotIn("返回工作区", sidebar)
        self.assertIn("pisces.sidebar.modules.v1", sidebar)
        self.assertNotIn("MutationObserver", sidebar)
        self.assertNotIn("pisces.sidebar.activeSection.v2", sidebar)
        self.assertLess(layout.index('key: "variables"'), layout.index('key: "timeline"'))
        self.assertLess(layout.index('key: "volumeLayers"'), layout.index('key: "region"'))
        self.assertNotIn('key: "analysisMode"', layout)
        self.assertNotIn('data-section="analysis-mode"', self.index)
        self.assertIn("showVolumeLayers", sidebar)
        self.assertIn("canSelectRegion", sidebar)
        self.assertIn('shell?.classList.toggle("module-unavailable"', sidebar)
        self.assertIn(':disabled="!moduleAvailable(item.key)"', sidebar)
        for reason in (
            "单帧数据，无时间轴",
            "表面变量，无深度维度",
            "当前变量不是矢量场",
            "请先切换到三维场",
        ):
            self.assertIn(reason, sidebar)
        for capability in (
            "showTimeline", "showDepth", "showVectors",
            "showVolumeLayers", "showAnalysis", "canSelectRegion",
        ):
            self.assertIn(f"{capability}:", ui_events)
        self.assertIn('<slot name="context" />', app_header)
        self.assertIn("<ExplorerPanelSwitcher />", explorer_app)
        self.assertIn("当前编辑窗口", switcher)
        self.assertIn('return id === "left" ? "左窗口" : "右窗口"', switcher)
        self.assertIn('当前控制：{{ panel.active === "left" ? "左窗口" : "右窗口" }}', sidebar)
        self.assertIn('CustomEvent("pisces:panel-command"', switcher)
        self.assertIn('command(state.panels[id].enabled ? "activate" : "open", id)', switcher)
        self.assertIn('class="header-panel-close"', switcher)
        self.assertIn("enabledPanels.length > 1", switcher)
        self.assertIn('document.addEventListener("pisces:panel-command"', self.controller)
        for source in ("数据集 A", "数据集 B", "差值 A−B"):
            self.assertIn(source, ui_events)
        for field in ("sourceLabel", "paletteLabel"):
            self.assertIn(f"{field}:", ui_events)
        self.assertIn("pisces:workspace-state", sidebar)
        self.assertIn("pisces:panel-state", sidebar)
        self.assertIn('id="sidebar-vue-context"', self.index)

    def test_palette_uses_presets_only(self):
        controls = (
            self.root / "frontend/js/features/controls/range-controls.js"
        ).read_text(encoding="utf-8")
        self.assertIn('id="colorscale-select"', self.index)
        for custom_control in (
            "color-min-swatch", "color-min-hex",
            "color-max-swatch", "color-max-hex",
        ):
            self.assertNotIn(custom_control, self.index)
            self.assertNotIn(custom_control, controls)
        self.assertIn("defaultConfiguration.colorscale", controls)
        self.assertIn("color_min: null", controls)
        self.assertIn("color_max: null", controls)

    def test_sidebar_summary_stays_fixed_above_scrolling_controls(self):
        styles = (self.root / "frontend/style.css").read_text(encoding="utf-8")
        self.assertIn(".explorer-sidebar-tool { flex: 0 0 auto;", styles)
        self.assertIn(".sidebar-control-pane::-webkit-scrollbar", styles)
        self.assertIn(".sidebar-control-pane {", styles)
        self.assertIn("margin-top: 9px;", styles)
        self.assertIn("overflow-y: auto;", styles)
        self.assertIn("overscroll-behavior: contain;", styles)
        self.assertIn("background: #fff;", styles)

    def test_registry_has_mode_defaults_and_difference(self):
        for view_type in (
            "volume3d",
            "layer2d",
            "comparisonA",
            "comparisonB",
            "comparisonDifference",
            "comparisonVolumeA",
            "comparisonVolumeB",
            "comparisonVolumeDifference",
        ):
            self.assertIn(view_type, self.registry)
        self.assertIn('state.panelSlots.left.viewType = "comparisonA"', self.registry)
        self.assertIn('state.panelSlots.right.viewType = "comparisonB"', self.registry)
        self.assertIn("SessionStore.forPanel(slotId)", self.registry)

    def test_comparison_requests_use_independent_panel_state(self):
        self.assertEqual(self.controller.count("ComparisonView.load({"), 1)
        self.assertIn("const state = panelState(slotId)", self.controller)
        self.assertIn("renderComparisonSlot(slotId, run)", self.controller)
        comparison_view = (
            self.root / "frontend/js/features/comparison/view.js"
        ).read_text(encoding="utf-8")
        self.assertIn("quiverStep: options.quiverStep", comparison_view)
        self.assertIn('params.set("step", options.quiverStep)', comparison_view)
        self.assertIn("const cachePromises = new Map()", comparison_view)
        self.assertIn("savedRanges.set(slotId, update)", comparison_view)

    def test_panel_state_is_independent_and_persisted(self):
        session_store = (
            self.root / "frontend/js/core/session-store.js"
        ).read_text(encoding="utf-8")
        self.assertIn('left: createPanel("left")', session_store)
        self.assertIn('right: createPanel("right")', session_store)
        self.assertIn("function forPanel(slotId)", session_store)
        self.assertIn("workspace.panels", session_store)
        self.assertIn("serializeConfiguration", session_store)
        self.assertIn("active_panel: base.activeAnalysisSlot", session_store)
        self.assertIn("mode: panel.mode", session_store)
        self.assertIn("date: base.dates[panel.dateIdx]", session_store)
        self.assertIn("base.dates.indexOf(panelSaved.date)", session_store)
        self.assertIn("Plotly.purge(graph)", self.controller)
        self.assertIn("enabledSlots(options.state).map", self.controller)

    def test_bottom_analysis_labels_are_explicit(self):
        self.assertIn("单点垂直剖面", self.index)
        self.assertIn("两点垂直断面", self.index)
        self.assertIn('id="analysis-source-badge"', self.index)
        self.assertNotIn("分析数据来源", self.index)
        self.assertNotIn('id="comparison-analysis-source"', self.index)

    def test_analysis_toolbar_is_single_row_without_sidebar_mode_proxy(self):
        styles = (self.root / "frontend/style.css").read_text(encoding="utf-8")
        analysis_controls = (
            self.root / "frontend/js/features/controls/analysis-controls.js"
        ).read_text(encoding="utf-8")
        variable_controls = (
            self.root / "frontend/js/features/controls/variable-controls.js"
        ).read_text(encoding="utf-8")
        self.assertIn("overflow-x: auto;", styles)
        self.assertIn("flex-wrap: nowrap;", styles)
        self.assertIn("flex: 0 0 150px;", styles)
        self.assertIn('class="dual-range-wrap analysis-range-slider"', self.index)
        self.assertNotIn('input[name="mode"]', analysis_controls)
        self.assertIn('void selectMode("point")', analysis_controls)
        self.assertIn('void selectMode("transect")', analysis_controls)
        self.assertNotIn('getElementById("mode-point")', variable_controls)

    def test_analysis_source_follows_active_window(self):
        analysis_controls = (
            self.root / "frontend/js/features/controls/analysis-controls.js"
        ).read_text(encoding="utf-8")
        workspace_controller = (
            self.root / "frontend/js/features/workspace/controller.js"
        ).read_text(encoding="utf-8")
        app = (self.root / "frontend/app.js").read_text(encoding="utf-8")
        self.assertIn("syncAnalysisSource(state)", self.controller)
        self.assertIn(
            '["a", "b", "difference"].includes(source)',
            self.controller,
        )
        self.assertNotIn("comparison-analysis-source", analysis_controls)
        self.assertIn('difference: "差值 A−B"', app)
        self.assertNotIn("activate-${slotId}-panel", workspace_controller)


if __name__ == "__main__":
    unittest.main()
