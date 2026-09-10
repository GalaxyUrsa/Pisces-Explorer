import unittest
from types import SimpleNamespace
from unittest.mock import patch

import numpy as np

from backend.comparison import (
    build_layer_comparison,
    comparison_data,
    pair_frames,
    pair_series,
    single_comparison_label,
    unchanged_dates,
)
from backend.features.dataset.router import get_dates
from backend.features.profile.figure import make_profile_fig
from backend.features.transect.figure import make_transect_fig


def _frame(date: str, value: float) -> dict:
    field = np.full((2, 4, 5), value, dtype=float)
    return {
        "date": date,
        "temp": field,
        "ss": field,
        "lats": np.arange(4, dtype=float),
        "lons": np.arange(5, dtype=float),
        "depths": np.array([1.0, 10.0]),
    }


class ComparisonTests(unittest.TestCase):
    def test_single_frames_can_be_paired_without_enabling_series(self):
        pair = pair_frames(
            _frame("20260101", 1),
            _frame("20260101", 2),
            "20260101",
        )
        fake_runtime = SimpleNamespace(
            is_comparison=True,
            state={
                "series_dates": ["20260101"],
                "comparison_files": [{
                    "date": "20260101",
                    "a": "prediction_20260101.nc",
                    "b": "target_20260101.nc",
                }],
            },
        )

        with patch("backend.features.dataset.router.runtime", fake_runtime):
            dates = get_dates()

        self.assertEqual(pair["date"], "20260101")
        self.assertEqual(pair["source_dates"]["a"], "20260101")
        self.assertEqual(pair["source_dates"]["b"], "20260101")
        self.assertTrue(dates["is_comparison"])
        self.assertFalse(dates["is_series"])
        self.assertEqual(dates["dates"], ["20260101"])

    def test_single_comparison_label_supports_cross_date_pairs(self):
        self.assertEqual(
            single_comparison_label(
                "prediction_20260101.nc",
                "target_20260101.nc",
            ),
            "20260101",
        )
        self.assertEqual(
            single_comparison_label("prediction.nc", "target.nc"),
            "单日",
        )
        self.assertEqual(
            single_comparison_label(
                "prediction_20260101.nc",
                "target_20260102.nc",
            ),
            "20260101 vs 20260102",
        )

    def test_cross_date_pair_preserves_each_source_date(self):
        frame_a = _frame("20260101 vs 20260102", 1)
        frame_b = _frame("20260101 vs 20260102", 2)
        frame_a["filename"] = "prediction_20260101.nc"
        frame_b["filename"] = "target_20260102.nc"

        pair = pair_frames(frame_a, frame_b, "20260101 vs 20260102")

        self.assertEqual(pair["source_dates"], {
            "a": "20260101",
            "b": "20260102",
        })

    def test_pair_series_keeps_b_frames_aligned_by_date(self):
        pairs = pair_series(
            [_frame("20260102", 2), _frame("20260101", 1)],
            [_frame("20260101", 10), _frame("20260102", 20)],
        )

        self.assertEqual(
            [pair["date"] for pair in pairs], ["20260101", "20260102"]
        )
        self.assertEqual(pairs[0]["b"]["temp"][0, 0, 0], 10)
        self.assertEqual(pairs[1]["b"]["temp"][0, 0, 0], 20)

    def test_comparison_metrics_and_markers_change_with_b_frame(self):
        pairs = pair_series(
            [_frame("20260101", 1), _frame("20260102", 2)],
            [_frame("20260101", 10), _frame("20260102", 20)],
        )

        def build(pair):
            return build_layer_comparison(
                pair,
                variable="temp",
                depth_idx=0,
                is_2d=False,
                points=[{"lat": 1, "lon": 2}],
                get_data=lambda variable, frame: frame[variable],
                vmin=0,
                vmax=20,
                colorscale="Viridis",
            )

        first, second = build(pairs[0]), build(pairs[1])

        self.assertEqual(first["metrics"], {"mae": 9.0, "rmse": 9.0})
        self.assertEqual(second["metrics"], {"mae": 18.0, "rmse": 18.0})
        self.assertTrue(
            all(len(figure["data"]) == 2 for figure in first["figures"].values())
        )

    def test_composite_current_comparison_keeps_vector_arrows(self):
        frame_a = _frame("20260101", 1)
        frame_b = _frame("20260101", 2)
        frame_a["uo"] = np.full_like(frame_a["temp"], 1.0)
        frame_a["vo"] = np.full_like(frame_a["temp"], 0.5)
        frame_b["uo"] = np.full_like(frame_b["temp"], 0.25)
        frame_b["vo"] = np.full_like(frame_b["temp"], 0.1)
        pair = {"date": "20260101", "a": frame_a, "b": frame_b}

        def get_data(variable, frame):
            if variable == "uv":
                return frame["uo"], frame["vo"]
            return frame[variable]

        result = build_layer_comparison(
            pair,
            variable="uv",
            depth_idx=0,
            is_2d=False,
            points=[],
            get_data=get_data,
            vmin=0,
            vmax=2,
            colorscale="Viridis",
            quiver_step=2,
        )

        for source in ("a", "b", "difference"):
            traces = result["figures"][source]["data"]
            self.assertEqual(len(traces), 3)
            self.assertEqual(traces[1]["mode"], "lines")
            self.assertEqual(traces[2]["marker"]["symbol"], "arrow")

    def test_unchanged_b_frames_are_reported(self):
        first_b = _frame("20260101", 10)
        second_b = _frame("20260102", 10)
        first_b["filename"] = "first_20260101.nc"
        second_b["filename"] = "second_20260102.nc"
        pairs = pair_series(
            [_frame("20260101", 1), _frame("20260102", 2)],
            [first_b, second_b],
        )

        self.assertEqual(unchanged_dates(pairs, "b"), ["20260102"])
        self.assertEqual(unchanged_dates(pairs, "a"), [])

    def test_profile_and_transect_can_select_a_b_or_difference(self):
        pair = {
            "a": _frame("20260101", 7),
            "b": _frame("20260101", 2),
        }
        get_data = lambda variable, frame: frame[variable]

        self.assertTrue(
            np.all(comparison_data(pair, "temp", "a", get_data) == 7)
        )
        self.assertTrue(
            np.all(comparison_data(pair, "temp", "b", get_data) == 2)
        )
        self.assertTrue(
            np.all(comparison_data(pair, "temp", "difference", get_data) == 5)
        )

    def test_moved_profile_and_transect_figures_keep_expected_labels(self):
        frame = _frame("20260101", 7)
        profile, profile_title, _ = make_profile_fig(
            frame["temp"],
            frame["lats"],
            frame["lons"],
            frame["depths"],
            lat=1,
            lon=2,
            depth_idx=0,
            variable="temp",
            is_difference=True,
        )
        transect, transect_title, _ = make_transect_fig(
            frame["temp"],
            frame["lats"],
            frame["lons"],
            frame["depths"],
            {"lat": 0, "lon": 0},
            {"lat": 3, "lon": 4},
            depth_idx=0,
            variable="temp",
            is_difference=True,
        )

        self.assertIn("温度差值（A − B）垂直剖面", profile_title)
        self.assertIn("温度差值（A − B）垂直断面", transect_title)
        self.assertTrue(profile["data"])
        self.assertTrue(transect["data"])


if __name__ == "__main__":
    unittest.main()
