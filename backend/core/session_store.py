"""In-memory analysis session state.

The mapping interface keeps legacy routes working while new features use the
explicit session properties.
"""

from __future__ import annotations


class SessionStore:
    def __init__(self):
        self._data: dict = {}

    def __contains__(self, key):
        return key in self._data

    def __getitem__(self, key):
        return self._data[key]

    def __setitem__(self, key, value):
        self._data[key] = value

    def get(self, key, default=None):
        return self._data.get(key, default)

    def pop(self, key, default=None):
        return self._data.pop(key, default)

    def clear(self):
        self._data.clear()

    @property
    def ready(self) -> bool:
        return "ss" in self._data

    @property
    def is_series(self) -> bool:
        return len(self._data.get("series", [])) > 1

    @property
    def is_comparison(self) -> bool:
        return "comparison_series" in self._data

    def clear_mode_state(self):
        for key in (
            "series",
            "series_dates",
            "comparison_series",
            "comparison_labels",
            "comparison_files",
        ):
            self._data.pop(key, None)
