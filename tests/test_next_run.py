"""Tests for the pure scheduling helpers in ``next_run.py``.

These tests run with plain pytest and do NOT require a Home Assistant
installation: ``next_run.py`` is self-contained (zero HA imports, zero relative
imports) and is loaded directly by file path.

Coverage:
- the 9 original ``compute_next_run`` tests (kept green),
- ``find_next_run`` returning ``(datetime, schedule)``,
- ``resolve_target_services`` for every supported domain + ValueError,
- ``off_states`` for valve vs switch + ValueError,
- DST policy: spring-forward gap skipped, fall-back ambiguity resolved.
"""

from __future__ import annotations

from datetime import datetime, time as dt_time, timezone

import pytest
from zoneinfo import ZoneInfo

from .pure_loader import load_pure_module

_next_run = load_pure_module("next_run.py")

compute_next_run = _next_run.compute_next_run
find_next_run = _next_run.find_next_run
resolve_target_services = _next_run.resolve_target_services
off_states = _next_run.off_states

TZ = timezone.utc


def _dt(
    year: int, month: int, day: int, hour: int, minute: int = 0, second: int = 0
) -> datetime:
    """Build an aware datetime in UTC for the given wall-clock fields."""
    return datetime(year, month, day, hour, minute, second, tzinfo=TZ)


# ---------------------------------------------------------------------------
# Original 9 compute_next_run tests (kept green)
# ---------------------------------------------------------------------------
def test_next_run_same_day() -> None:
    """A run scheduled later today wins."""
    schedules = [{"time": "06:30:00", "days": [0], "duration": 900, "enabled": True}]
    now = _dt(2024, 5, 6, 6, 0)  # Monday 06:00
    expected = _dt(2024, 5, 6, 6, 30)
    assert compute_next_run(schedules, now) == expected


def test_next_run_next_day() -> None:
    """A run on the following day wins."""
    schedules = [{"time": "06:00:00", "days": [1], "duration": 900, "enabled": True}]
    now = _dt(2024, 5, 6, 20, 0)  # Monday 20:00
    expected = _dt(2024, 5, 7, 6, 0)  # Tuesday 06:00
    assert compute_next_run(schedules, now) == expected


def test_next_run_week_wrap_sunday_to_monday() -> None:
    """Sunday 20:00 with a Monday-only schedule must roll to next Monday."""
    schedules = [{"time": "06:00:00", "days": [0], "duration": 900, "enabled": True}]
    now = _dt(2024, 5, 12, 20, 0)  # Sunday 20:00
    expected = _dt(2024, 5, 13, 6, 0)  # Monday 06:00
    assert compute_next_run(schedules, now) == expected


def test_enabled_false_returns_none() -> None:
    """Scheduling disabled overall returns None."""
    schedules = [{"time": "06:00:00", "days": [0], "duration": 900, "enabled": True}]
    assert compute_next_run(schedules, _dt(2024, 5, 6, 5, 0), enabled=False) is None


def test_disabled_schedule_is_ignored() -> None:
    """A schedule with enabled=False must be skipped."""
    schedules = [
        {"time": "06:00:00", "days": [0], "duration": 900, "enabled": False},
        {"time": "07:00:00", "days": [1], "duration": 900, "enabled": True},
    ]
    now = _dt(2024, 5, 6, 0, 0)  # Monday 00:00
    expected = _dt(2024, 5, 7, 7, 0)  # Tuesday 07:00
    assert compute_next_run(schedules, now) == expected


def test_empty_schedules_returns_none() -> None:
    """No schedules at all returns None."""
    assert compute_next_run([], _dt(2024, 5, 6, 0, 0)) is None


def test_same_weekday_after_time_rolls_to_next_week() -> None:
    """If today's slot already passed, roll forward a full week."""
    schedules = [{"time": "06:00:00", "days": [0], "duration": 900, "enabled": True}]
    now = _dt(2024, 5, 6, 7, 0)  # Monday 07:00
    expected = _dt(2024, 5, 13, 6, 0)  # next Monday 06:00
    assert compute_next_run(schedules, now) == expected


def test_accepts_datetime_time_objects() -> None:
    """Schedules may carry a datetime.time value instead of a string."""
    schedules = [
        {"time": dt_time(6, 30), "days": [0], "duration": 900, "enabled": True}
    ]
    now = _dt(2024, 5, 6, 6, 0)
    expected = _dt(2024, 5, 6, 6, 30)
    assert compute_next_run(schedules, now) == expected


def test_earliest_of_multiple_candidates_wins() -> None:
    """Among several matching schedules, the smallest datetime is returned."""
    schedules = [
        {"time": "08:00:00", "days": [1], "duration": 900, "enabled": True},
        {"time": "06:30:00", "days": [1], "duration": 900, "enabled": True},
    ]
    now = _dt(2024, 5, 6, 0, 0)  # Monday 00:00
    expected = _dt(2024, 5, 7, 6, 30)  # Tuesday 06:30
    assert compute_next_run(schedules, now) == expected


# ---------------------------------------------------------------------------
# find_next_run returns (datetime, schedule)
# ---------------------------------------------------------------------------
def test_find_next_run_returns_schedule_too() -> None:
    """find_next_run must return the matching schedule alongside the datetime."""
    first = {"time": "06:30:00", "days": [1], "duration": 900, "enabled": True}
    second = {"time": "08:00:00", "days": [1], "duration": 1200, "enabled": True}
    schedules = [first, second]
    now = _dt(2024, 5, 6, 0, 0)  # Monday 00:00
    next_run, schedule = find_next_run(schedules, now)
    assert next_run == _dt(2024, 5, 7, 6, 30)
    assert schedule is first


def test_find_next_run_none_when_disabled() -> None:
    """find_next_run returns (None, None) when scheduling is disabled."""
    schedules = [{"time": "06:00:00", "days": [0], "duration": 900, "enabled": True}]
    assert find_next_run(schedules, _dt(2024, 5, 6, 5, 0), enabled=False) == (None, None)


# ---------------------------------------------------------------------------
# resolve_target_services / off_states
# ---------------------------------------------------------------------------
def test_resolve_target_services_valve() -> None:
    """valve uses valve.open_valve / close_valve (no homeassistant.turn_*)."""
    assert resolve_target_services("valve") == ("valve", "open_valve", "close_valve")


def test_resolve_target_services_homeassistant_domains() -> None:
    """switch / input_boolean / light go through homeassistant.turn_on/off."""
    for domain in ("switch", "input_boolean", "light"):
        assert resolve_target_services(domain) == (
            "homeassistant",
            "turn_on",
            "turn_off",
        )


def test_resolve_target_services_unknown_domain_raises() -> None:
    """Unknown domains raise ValueError."""
    with pytest.raises(ValueError):
        resolve_target_services("fan")
    with pytest.raises(ValueError):
        resolve_target_services("climate")


def test_off_states_valve_has_closed_not_off() -> None:
    """valve off states: closed (never off), plus unavailable/unknown."""
    states = off_states("valve")
    assert "closed" in states
    assert "off" not in states
    assert "unavailable" in states
    assert "unknown" in states


def test_off_states_switch_has_off() -> None:
    """switch off states include off."""
    states = off_states("switch")
    assert "off" in states


def test_off_states_unknown_domain_raises() -> None:
    """Unknown domains raise ValueError."""
    with pytest.raises(ValueError):
        off_states("fan")


# ---------------------------------------------------------------------------
# DST policy
# ---------------------------------------------------------------------------
def _ny_tz() -> ZoneInfo:
    """Return the America/New_York zone, skipping if tzdata is unavailable."""
    try:
        return ZoneInfo("America/New_York")
    except Exception as exc:  # noqa: BLE001 - ZoneInfoNotFoundError on some OS
        pytest.skip(f"IANA timezone database not available on this platform: {exc}")


def test_spring_forward_gap_time_is_skipped() -> None:
    """A schedule time in the spring-forward gap is skipped for that day.

    2024-03-10 in America/New_York: 02:00 jumps to 03:00, so 02:30 does not
    exist. The schedule must fire on the next matching Sunday at 02:30 EDT.
    """
    tz = _ny_tz()
    now = datetime(2024, 3, 10, 1, 0, tzinfo=tz)  # 01:00 EST, before the gap
    schedules = [
        {"time": "02:30:00", "days": [6], "duration": 900, "enabled": True}
    ]
    expected = datetime(2024, 3, 17, 2, 30, tzinfo=tz)  # next Sunday
    assert compute_next_run(schedules, now) == expected


def test_fall_back_ambiguous_time_uses_earlier_occurrence() -> None:
    """A fall-back ambiguous time (01:30 twice) fires on the first occurrence.

    2024-11-03 in America/New_York: 02:00 EDT jumps back to 01:00 EST, so
    01:30 exists twice. Candidates are built with fold=0 -> the earlier one.
    """
    tz = _ny_tz()
    now = datetime(2024, 11, 2, 12, 0, tzinfo=tz)  # Saturday noon
    schedules = [
        {"time": "01:30:00", "days": [6], "duration": 900, "enabled": True}
    ]
    expected = datetime(2024, 11, 3, 1, 30, tzinfo=tz)  # fold=0 (EDT)
    assert compute_next_run(schedules, now) == expected
