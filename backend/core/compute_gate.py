"""Global guard for resource-intensive inference work."""

from __future__ import annotations

import threading


_LOCK = threading.Lock()
_ACTIVE: dict | None = None


def begin(task_id: str) -> bool:
    global _ACTIVE
    with _LOCK:
        if _ACTIVE is not None:
            return False
        _ACTIVE = {"task_id": task_id, "progress": 0, "stage": "等待执行"}
        return True


def update(task_id: str, progress: int, stage: str) -> None:
    with _LOCK:
        if _ACTIVE and _ACTIVE["task_id"] == task_id:
            _ACTIVE.update(progress=progress, stage=stage)


def finish(task_id: str) -> None:
    global _ACTIVE
    with _LOCK:
        if _ACTIVE and _ACTIVE["task_id"] == task_id:
            _ACTIVE = None


def active() -> dict | None:
    with _LOCK:
        return _ACTIVE.copy() if _ACTIVE else None
