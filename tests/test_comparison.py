import unittest

import numpy as np

from backend.comparison import (
    build_layer_comparison,
    comparison_data,
    pair_series,
    unchanged_dates,
)
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
