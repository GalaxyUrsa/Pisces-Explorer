import ast
import unittest
from pathlib import Path

import numpy as np
from fastapi.testclient import TestClient

from backend.core.feature_registry import FEATURE_REGISTRY
from backend.core.runtime import runtime
from backend.core.variables import VARIABLE_REGISTRY
from backend.main import app


class ArchitectureTests(unittest.TestCase):
    def tearDown(self):
        runtime.state.clear()

    def test_registered_feature_routes_are_exposed(self):
        paths = set(app.openapi()["paths"])
        expected = {
            "/api/upload",
            "/api/upload_series",
            "/api/upload_comparison",
            "/api/volume",
            "/api/layer/{depth_idx}",
            "/api/comparison/layer/{depth_idx}",
            "/api/comparison/volume",
            "/api/profile",
            "/api/transect",
        }
        self.assertTrue(expected.issubset(paths))

    def test_core_registries_contain_current_capabilities(self):
        self.assertEqual(
            set(FEATURE_REGISTRY),
            {
                "dataset",
                "volume",
                "layer",
                "profile",
                "transect",
                "comparison",
            },
        )
        self.assertIn("temp", VARIABLE_REGISTRY)
        self.assertIn("uv", VARIABLE_REGISTRY)

    def test_target_feature_modules_exist(self):
        root = Path(__file__).resolve().parents[1]
        expected = [
            "backend/plotting/common.py",
            "backend/features/dataset/service.py",
            "backend/features/volume/figure.py",
            "backend/features/layer/figure.py",
            "backend/features/profile/figure.py",
            "backend/features/transect/figure.py",
            "backend/features/comparison/figure.py",
            "frontend/js/interactions/map-selection.js",
            "frontend/js/core/panel-registry.js",
            "frontend/js/components/panel-slot.js",
            "frontend/js/features/workspace/panel-controller.js",
        ]
        self.assertFalse(
            [path for path in expected if not (root / path).is_file()]
        )

    def test_core_does_not_import_feature_modules(self):
        root = Path(__file__).resolve().parents[1]
        imported_modules = []
        for path in (root / "backend/core").glob("*.py"):
            tree = ast.parse(path.read_text(encoding="utf-8"))
            for node in ast.walk(tree):
                if isinstance(node, ast.Import):
                    imported_modules.extend(alias.name for alias in node.names)
                elif isinstance(node, ast.ImportFrom) and node.module:
                    imported_modules.append(node.module)
        self.assertFalse(
            [
                module
                for module in imported_modules
                if module == "features"
                or module.startswith("features.")
                or ".features." in module
            ]
        )

    def test_frontend_module_scripts_are_served_before_app_entry(self):
        client = TestClient(app)
        index = client.get("/").text
        module_paths = [
            "/static/js/components/dual-range.js",
            "/static/js/components/sidebar-controller.js",
            "/static/js/components/sidebar-sections.js",
            "/static/js/interactions/map-selection.js",
            "/static/js/features/controls/range-controls.js",
            "/static/js/features/controls/layer-visibility-controls.js",
            "/static/js/features/controls/variable-controls.js",
            "/static/js/features/controls/visualization-controls.js",
            "/static/js/features/controls/analysis-controls.js",
            "/static/js/features/workspace/controller.js",
            "/static/js/features/workspace/panel-controller.js",
            "/static/js/features/comparison/view.js",
        ]
        app_position = index.index("/static/app.js")
        for path in module_paths:
            self.assertEqual(client.get(path).status_code, 200)
            self.assertLess(index.index(path), app_position)
        icon_sprite = "/static/assets/icons/sidebar-icons.svg"
        icon_response = client.get(icon_sprite)
        self.assertEqual(icon_response.status_code, 200)
        self.assertIn("<symbol", icon_response.text)

    def test_comparison_route_uses_selected_b_date(self):
        def frame(date, value):
            field_3d = np.full((2, 4, 5), value, dtype=float)
            field_2d = np.full((4, 5), value, dtype=float)
            return {
                "date": date,
                "filename": f"frame_{date}.nc",
                "ss": field_3d,
                "temp": field_3d,
                "salt": field_3d,
                "uo": field_3d,
                "vo": field_3d,
                "u10": field_2d,
                "v10": field_2d,
                "swh": field_2d,
                "mwd_u": field_2d,
                "mwd_v": field_2d,
                "lats": np.arange(4, dtype=float),
                "lons": np.arange(5, dtype=float),
                "depths": np.array([1.0, 10.0]),
            }

        a_frames = [frame("20260101", 1), frame("20260102", 2)]
        b_frames = [frame("20260101", 10), frame("20260102", 20)]
        runtime.init_series(a_frames)
        runtime.state["comparison_series"] = [
            {"date": a["date"], "a": a, "b": b}
            for a, b in zip(a_frames, b_frames)
        ]

        client = TestClient(app)
        first = client.get(
            "/api/comparison/layer/0",
            params={"variable": "temp", "date_idx": 0},
        ).json()
        second = client.get(
            "/api/comparison/layer/0",
            params={"variable": "temp", "date_idx": 1},
        ).json()

        self.assertEqual(first["stats"]["b"]["mean"], 10)
        self.assertEqual(second["stats"]["b"]["mean"], 20)

        volume_b_first = client.get(
            "/api/comparison/volume",
            params={
                "variable": "temp",
                "date_idx": 0,
                "comparison_source": "b",
            },
        ).json()
        volume_b_second = client.get(
            "/api/comparison/volume",
            params={
                "variable": "temp",
                "date_idx": 1,
                "comparison_source": "b",
            },
        ).json()
        difference = client.get(
            "/api/comparison/volume",
            params={
                "variable": "temp",
                "date_idx": 1,
                "comparison_source": "difference",
            },
        ).json()
        self.assertEqual(volume_b_first["date"], "20260101")
        self.assertEqual(volume_b_second["date"], "20260102")
        self.assertIn("序列 B", volume_b_second["title"])
        self.assertIn("差值", difference["title"])
        self.assertTrue(volume_b_second["figure"]["data"])


if __name__ == "__main__":
    unittest.main()
