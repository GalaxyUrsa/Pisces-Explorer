import ast
import json
import unittest
from pathlib import Path

import numpy as np
import xarray as xr
from fastapi.testclient import TestClient

from backend.core.feature_registry import FEATURE_REGISTRY
from backend.core import compute_gate
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
            "/api/status",
            "/api/session",
            "/api/simulator/eddy",
            "/api/simulator/preview",
            "/api/simulator/results/latest",
            "/api/simulator/results/{filename}",
            "/api/simulator/results/{filename}/load",
            "/api/inference/run",
            "/api/inference/tasks",
            "/api/inference/tasks/{task_id}",
            "/api/inference/results/latest",
            "/api/inference/results/{run_id}/{filename}",
            "/api/inference/results/{run_id}/load",
            "/api/hub/assets",
            "/api/hub/assets/{asset_id}",
            "/api/hub/assets/{asset_id}/load",
            "/api/volume",
            "/api/layer/{depth_idx}",
            "/api/comparison/layer/{depth_idx}",
            "/api/comparison/volume",
            "/api/profile",
            "/api/transect",
        }
        self.assertTrue(expected.issubset(paths))

    def test_inference_gate_blocks_business_api_but_allows_progress(self):
        self.assertTrue(compute_gate.begin("busy-task"))
        try:
            with TestClient(app) as client:
                blocked = client.get("/api/status")
                progress = client.get("/api/inference/tasks/busy-task")
        finally:
            compute_gate.finish("busy-task")

        self.assertEqual(blocked.status_code, 423)
        self.assertEqual(blocked.json()["task_id"], "busy-task")
        self.assertEqual(progress.status_code, 404)

    def test_session_status_and_clear_expose_loaded_dataset_identity(self):
        runtime.state["ss"] = np.zeros((1, 1, 1))
        runtime.set_dataset_manifest(
            "comparison",
            [{"name": "a_20260101.nc", "date": "20260101"}],
            [{"name": "b_20260101.nc", "date": "20260101"}],
            dates=["20260101"],
            label="单日对比 20260101",
        )
        with TestClient(app) as client:
            status = client.get("/api/status")
            cleared = client.delete("/api/session")
            empty = client.get("/api/status")

        self.assertEqual(status.status_code, 200)
        self.assertEqual(status.json()["mode"], "comparison")
        self.assertEqual(status.json()["datasets"]["a"][0]["name"], "a_20260101.nc")
        self.assertEqual(status.json()["datasets"]["b"][0]["name"], "b_20260101.nc")
        self.assertEqual(cleared.json(), {"ok": True, "ready": False})
        self.assertFalse(empty.json()["ready"])

    def test_session_status_recovers_legacy_series_file_identity(self):
        runtime.state["ss"] = np.zeros((1, 1, 1))
        runtime.state["series_dates"] = ["20260101", "20260102"]
        runtime.state["series"] = [
            {"filename": "target_20260101.nc", "date": "20260101"},
            {"filename": "target_20260102.nc", "date": "20260102"},
        ]

        with TestClient(app) as client:
            status = client.get("/api/status").json()

        self.assertEqual(status["mode"], "series")
        self.assertEqual(status["dates"], ["20260101", "20260102"])
        self.assertEqual(
            [item["name"] for item in status["datasets"]["a"]],
            ["target_20260101.nc", "target_20260102.nc"],
        )

    def test_single_file_a_b_comparison_does_not_enable_series(self):
        values = np.ones((1, 2, 2, 3), dtype=float)
        dataset = xr.Dataset(
            {
                "thetao": (
                    ("time", "depth", "latitude", "longitude"),
                    values,
                ),
                "so": (
                    ("time", "depth", "latitude", "longitude"),
                    values * 35,
                ),
                "uo": (
                    ("time", "depth", "latitude", "longitude"),
                    values,
                ),
                "vo": (
                    ("time", "depth", "latitude", "longitude"),
                    values * 0.5,
                ),
            },
            coords={
                "time": [0],
                "depth": [1.0, 10.0],
                "latitude": [20.0, 21.0],
                "longitude": [110.0, 111.0, 112.0],
            },
        )
        payload = bytes(dataset.to_netcdf())

        with TestClient(app) as client:
            response = client.post(
                "/api/upload_comparison",
                files=[
                    (
                        "files_a",
                        ("prediction_20260101.nc", payload, "application/x-netcdf"),
                    ),
                    (
                        "files_b",
                        ("target_20260101.nc", payload, "application/x-netcdf"),
                    ),
                ],
            )
            dates = client.get("/api/dates")
            current_comparison = client.get(
                "/api/comparison/layer/0?variable=uv&step=1"
            )
            cropped_comparison = client.get(
                "/api/comparison/layer/0",
                params={
                    "variable": "uv",
                    "step": 1,
                    "region": json.dumps([110.0, 111.0, 20.0, 21.0]),
                },
            )
            outside_profile = client.post(
                "/api/profile",
                json={
                    "lat": 21.0,
                    "lon": 112.0,
                    "depth_idx": 0,
                    "variable": "temp",
                    "region": [110.0, 111.0, 20.0, 21.0],
                },
            )

        self.assertEqual(response.status_code, 200, response.text)
        self.assertFalse(response.json()["is_series"])
        self.assertEqual(dates.status_code, 200)
        self.assertTrue(dates.json()["is_comparison"])
        self.assertFalse(dates.json()["is_series"])
        self.assertEqual(dates.json()["dates"], ["20260101"])
        self.assertEqual(
            current_comparison.status_code,
            200,
            current_comparison.text,
        )
        figures = current_comparison.json()["figures"]
        self.assertEqual(len(figures["a"]["data"]), 3)
        self.assertEqual(len(figures["b"]["data"]), 3)
        self.assertEqual(len(figures["difference"]["data"]), 1)
        self.assertEqual(cropped_comparison.status_code, 200)
        self.assertEqual(outside_profile.status_code, 400)
        self.assertEqual(outside_profile.json()["detail"], "point is outside region")

    def test_core_registries_contain_current_capabilities(self):
        self.assertEqual(
            set(FEATURE_REGISTRY),
            {
                "dataset",
                "simulator",
                "inference",
                "hub",
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
            "frontend/js/features/controls/region-controls.js",
            "frontend/vue-app/src/shared/useWorkflow.ts",
            "frontend/vue-app/src/explorer/App.vue",
            "frontend/vue-app/src/explorer/legacy-runtime.ts",
            "frontend/vue-app/src/explorer/ExplorerSidebar.vue",
            "frontend/vue-app/src/explorer/sidebar-layout.ts",
            "frontend/js/core/ui-events.js",
            "frontend/vue-app/src/simulator/App.vue",
            "frontend/vue-app/src/inference/App.vue",
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
        runtime = (
            Path(__file__).resolve().parents[1]
            / "frontend/vue-app/src/explorer/legacy-runtime.ts"
        ).read_text(encoding="utf-8")
        module_paths = [
            "/static/js/components/dual-range.js",
            "/static/js/components/sidebar-controller.js",
            "/static/js/components/sidebar-sections.js",
            "/static/js/interactions/map-selection.js",
            "/static/js/features/controls/range-controls.js",
            "/static/js/features/controls/region-controls.js",
            "/static/js/features/controls/layer-visibility-controls.js",
            "/static/js/features/controls/variable-controls.js",
            "/static/js/features/controls/visualization-controls.js",
            "/static/js/features/controls/analysis-controls.js",
            "/static/js/features/workspace/controller.js",
            "/static/js/features/workspace/panel-controller.js",
            "/static/js/features/comparison/view.js",
        ]
        self.assertIn('<div id="app"></div>', index)
        self.assertIn("/static/vue-dist/assets/", index)
        self.assertIn("plotly.min.js", index)
        app_position = runtime.index("/static/app.js")
        for path in module_paths:
            self.assertEqual(client.get(path).status_code, 200)
            self.assertLess(runtime.index(path), app_position)
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
