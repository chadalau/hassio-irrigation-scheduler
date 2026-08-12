"""Tests for the pure schedule persistence helpers in ``schedules.py``.

Coverage:
- ``serialize_schedule`` never generates or touches ``id``,
- ``new_schedule`` generates ``id`` only at creation (and honours one already
  present),
- ``merge_schedule_update`` preserves the original ``id`` through a
  duration-only update and ignores any foreign ``id`` in the update fields,
- ``update_schedule`` round-trip: a full create-then-update flow keeps the
  original id stable.
"""

from __future__ import annotations

from datetime import time as dt_time

from .pure_loader import load_pure_module

_schedules = load_pure_module("schedules.py")

serialize_schedule = _schedules.serialize_schedule
new_schedule = _schedules.new_schedule
merge_schedule_update = _schedules.merge_schedule_update


# ---------------------------------------------------------------------------
# Serialization
# ---------------------------------------------------------------------------
def test_serialize_schedule_converts_time_and_never_generates_id() -> None:
    """Serialization converts datetime.time to a string and never adds an id."""
    serialized = serialize_schedule(
        {"time": dt_time(6, 30), "days": [0], "duration": 900, "enabled": True}
    )
    assert serialized["time"] == "06:30:00"
    assert "id" not in serialized


def test_serialize_schedule_keeps_existing_id() -> None:
    """Serialization must not change a pre-existing id."""
    schedule = {"id": "aaaa1111", "time": "06:00:00", "days": [0], "duration": 900}
    assert serialize_schedule(schedule)["id"] == "aaaa1111"


# ---------------------------------------------------------------------------
# Id generation only at creation
# ---------------------------------------------------------------------------
def test_new_schedule_generates_id_when_absent() -> None:
    """new_schedule (creation only) generates an id when none is present."""
    created = new_schedule({"time": "06:00:00", "days": [0], "duration": 900})
    assert "id" in created
    assert len(created["id"]) == 8
    assert created["time"] == "06:00:00"


def test_new_schedule_honours_provided_id() -> None:
    """new_schedule keeps an id the caller already provided."""
    with_id = new_schedule(
        {"id": "my-custom-id", "time": "06:00:00", "days": [0], "duration": 900}
    )
    assert with_id["id"] == "my-custom-id"


def test_new_schedule_generates_distinct_ids() -> None:
    """Two new schedules must not collide."""
    a = new_schedule({"time": "06:00:00", "days": [0], "duration": 900})
    b = new_schedule({"time": "07:00:00", "days": [1], "duration": 900})
    assert a["id"] != b["id"]


# ---------------------------------------------------------------------------
# Merge on update preserves id
# ---------------------------------------------------------------------------
def test_update_schedule_preserves_id_on_duration_update() -> None:
    """The original id must survive an update that only touches duration."""
    original = {
        "id": "aaaa1111",
        "time": "06:00:00",
        "days": [0],
        "duration": 900,
        "enabled": True,
    }
    merged = merge_schedule_update(original, {"duration": 1200})
    assert merged["id"] == "aaaa1111"
    assert merged["duration"] == 1200
    assert merged["time"] == "06:00:00"
    assert merged["days"] == [0]
    assert merged["enabled"] is True


def test_merge_schedule_update_ignores_foreign_id() -> None:
    """An id sneaking into the update fields must be ignored."""
    original = {"id": "aaaa1111", "time": "06:00:00", "days": [0], "duration": 900}
    merged = merge_schedule_update(original, {"id": "zzzz9999", "duration": 1800})
    assert merged["id"] == "aaaa1111"
    assert merged["duration"] == 1800


def test_merge_schedule_update_does_not_mutate_inputs() -> None:
    """Both input dicts stay untouched."""
    original = {"id": "aaaa1111", "time": "06:00:00", "days": [0], "duration": 900}
    fields = {"duration": 1200}
    merged = merge_schedule_update(original, fields)
    assert original["duration"] == 900
    assert fields == {"duration": 1200}
    assert merged["duration"] == 1200


# ---------------------------------------------------------------------------
# End-to-end: create then update (the update_schedule flow)
# ---------------------------------------------------------------------------
def test_create_then_update_keeps_id_stable() -> None:
    """Simulate add_schedule followed by update_schedule: id stays stable."""
    created = new_schedule(
        {"time": dt_time(6, 0), "days": [0], "duration": 900, "enabled": True}
    )
    schedule_id = created["id"]

    # The update service pops the id and serializes the remaining fields; the
    # serializer never re-injects an id (this was the corruption bug).
    fields = serialize_schedule({"duration": 1200})
    assert "id" not in fields

    updated = merge_schedule_update(created, fields)
    assert updated["id"] == schedule_id
    assert updated["duration"] == 1200
    assert updated["time"] == "06:00:00"
