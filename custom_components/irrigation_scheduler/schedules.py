"""Pure helpers for schedule persistence (zero Home Assistant imports).

Kept standalone (no relative imports) so it can be unit tested with plain
pytest. Responsibilities are split deliberately:

- ``serialize_schedule``: JSON-safe serialization (time -> "HH:MM:SS"). NEVER
  creates or changes the schedule ``id``.
- ``new_schedule``: serialization + id generation. Used ONLY when a schedule is
  created (add_schedule, and items without an id in set_schedules).
- ``merge_schedule_update``: applies update fields to an existing schedule
  without ever touching ``id`` (the id is immutable after creation).

This separation fixes the bug where ``update_schedule`` used to regenerate a
random id and overwrite the stored one.
"""

from __future__ import annotations

import uuid
from datetime import time as dt_time
from typing import Any

_KEY_ID = "id"
_KEY_TIME = "time"


def _generate_id() -> str:
    """Generate a short unique schedule id."""
    return uuid.uuid4().hex[:8]


def serialize_schedule(schedule: dict[str, Any]) -> dict[str, Any]:
    """Make a validated schedule JSON-serializable (string time).

    Does NOT generate or alter the schedule ``id``; callers that create a new
    schedule must use :func:`new_schedule` instead.
    """
    serialized = dict(schedule)
    time_value = serialized.get(_KEY_TIME)
    if isinstance(time_value, dt_time):
        serialized[_KEY_TIME] = time_value.strftime("%H:%M:%S")
    return serialized


def new_schedule(schedule: dict[str, Any]) -> dict[str, Any]:
    """Serialize a NEW schedule, generating its ``id`` only if absent."""
    serialized = serialize_schedule(schedule)
    serialized.setdefault(_KEY_ID, _generate_id())
    return serialized


def merge_schedule_update(
    schedule: dict[str, Any], fields: dict[str, Any]
) -> dict[str, Any]:
    """Apply ``fields`` to an existing schedule.

    The ``id`` key is immutable after creation: it is never injected, replaced
    or removed here (an ``id`` present in ``fields`` is ignored).
    """
    merged = dict(schedule)
    for key, value in dict(fields).items():
        if key == _KEY_ID:
            continue
        merged[key] = value
    return merged
