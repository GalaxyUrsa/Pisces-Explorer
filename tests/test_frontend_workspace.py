import unittest
import xml.etree.ElementTree as ET
from pathlib import Path


class FrontendWorkspaceTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.root = Path(__file__).resolve().parents[1]
        cls.index = (cls.root / "frontend/index.html").read_text(encoding="utf-8")
        cls.registry = (
            cls.root / "frontend/js/core/panel-registry.js"
        ).read_text(encoding="utf-8")
        cls.controller = (
            cls.root / "frontend/js/features/workspace/panel-controller.js"
        ).read_text(encoding="utf-8")

    def test_workspace_uses_two_reusable_slots(self):
        self.assertIn('id="slot-left"', self.index)
        self.assertIn('id="slot-right"', self.index)
        self.assertIn('id="analysis-panel"', self.index)
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
        self.assertIn("rail-flyout-open", sidebar_sections)
        self.assertIn('event.key === "Escape"', sidebar_sections)
        for section in (
            "data",
            "overview",
            "variables",
            "colors",
            "timeline",
            "depth",
            "analysis-mode",
            "selection",
        ):
            self.assertIn(f'data-section="{section}"', self.index)

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
        self.assertIn('left: { viewType: "comparisonA" }', self.registry)
        self.assertIn('right: { viewType: "comparisonB" }', self.registry)
        self.assertIn('state.varType === "3d" ? "volume3d" : "layer2d"', self.registry)

    def test_comparison_request_is_shared_by_both_slots(self):
        self.assertEqual(self.controller.count("ComparisonView.load({"), 1)
        self.assertIn("Promise.all(layerSlots.map", self.controller)

    def test_bottom_analysis_labels_are_explicit(self):
        self.assertIn("单点垂直剖面", self.index)
        self.assertIn("两点垂直断面", self.index)
        self.assertIn("分析数据来源", self.index)
        self.assertNotIn('<option value="difference">', self.index)


if __name__ == "__main__":
    unittest.main()
