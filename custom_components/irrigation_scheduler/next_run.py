"""Pure scheduling helpers for the Irrigation Scheduler integration.

This module MUST stay importable without Home Assistant installed and without
any other module of this integration (zero relative imports, zero HA imports).
It is the unit under test for the plain-pytest suite.

Public helpers
--------------
- ``find_next_run``: returns ``(next_run, schedule)`` for a set of schedules.
- ``compute_next_run``: wrapper around ``find_next_run`` returning only the
  datetime. Kept for backwards compatibility (existing tests / importers).
- ``resolve_target_services``: (service_domain, turn_on, turn_off) per domain.
- ``off_states``: states that mean "not actuating" per domain.

DST policy
----------
A schedule whose wall-clock time falls in the spring-forward gap (the local
time does not exist that day, e.g. 02:30 on a day where 02:00 jumps to 03:00)
is SKIPPED for that day; the next matching day is used. An ambiguous fall-back
time (01:30 when 02:00 jumps back to 01:00) exists twice; we build candidates
with ``fold=0``, so the earlier occurrence fires.
"""

from __future__ import annotations

from datetime import datetime, time, timedelta, timezone
from typing import Any

# Keys used in schedule dicts. Kept local so this module stays standalone.
_KEY_TIME = "time"
_KEY_DAYS = "days"
_KEY_ENABLED = "enabled"

# Days we look ahead: today .. same weekday next week. That covers weekday and
# week wrap correctly (0..7).
_MAX_DAY_OFFSET = 8

# Domains actuated through the ``homeassistant`` turn_on/turn_off services.
# ``valve`` is handled separately (open_valve/close_valve).
_HOMEASSISTANT_DOMAINS = frozenset({"switch", "input_boolean", "light"})

# (service_domain, turn_on_service, turn_off_service)
_VALVE_SERVICES = ("valve", "open_valve", "close_valve")
_HOMEASSISTANT_SERVICES = ("homeassistant", "turn_on", "turn_off")

# States that mean "not actuating" for a target domain.
_VALVE_OFF_STATES = frozenset({"closed", "unavailable", "unknown"})
_HOMEASSISTANT_OFF_STATES = frozenset({"off", "unavailable", "unknown"})

# States that mean "CONFIRMED off" -- an affirmative report from the device,
# never ``unavailable``/``unknown``. Used only to decide whether it is safe to
# discard the restart-recovery safety net; a device that merely stopped
# reporting is NOT proof the valve closed.
_VALVE_CONFIRMED_OFF_STATES = frozenset({"closed"})
_HOMEASSISTANT_CONFIRMED_OFF_STATES = frozenset({"off"})


def _parse_schedule_time(value: Any) -> time | None:
    """Parse a schedule ``time`` value: datetime.time or "HH:MM[:SS]"."""
    if isinstance(value, time):
        return value
    if not isinstance(value, str):
        return None
    parts = value.split(":")
    try:
        if len(parts) == 2:
            return time(int(parts[0]), int(parts[1]))
        if len(parts) == 3:
            return time(int(parts[0]), int(parts[1]), int(parts[2]))
    except (ValueError, TypeError):
        return None
    return None


def _local_time_exists(candidate: datetime) -> bool:
    """Whether the wall-clock time of ``candidate`` exists in its timezone.

    A time in the spring-forward gap does not exist: converting it to UTC and
    back yields a different wall-clock time, so neither fold matches the
    original candidate. Ambiguous fall-back times exist twice and match one of
    the two folds (we build candidates with ``fold=0``, i.e. the earlier
    occurrence fires).
    """
    if candidate.tzinfo is None:
        return True
    roundtrip = candidate.astimezone(timezone.utc).astimezone(candidate.tzinfo)
    return (
        roundtrip.replace(fold=0) == candidate
        or roundtrip.replace(fold=1) == candidate
    )


def find_next_run(
    schedules: list[dict[str, Any]],
    now: datetime,
    enabled: bool = True,
) -> tuple[datetime | None, dict[str, Any] | None]:
    """Return the ``(next_run, schedule)`` strictly after ``now``.

    A schedule dict must look like::

        {
            "time": "HH:MM:SS",   # or datetime.time
            "days": [0, 1, 2, 3, 4, 5, 6],  # 0 = Monday ... 6 = Sunday
            "duration": 900,      # seconds (not used for the computation)
            "enabled": True,
        }

    Candidates are built with the tzinfo of ``now``. Only candidates strictly
    after ``now`` on the UTC timeline are accepted and the smallest one is
    returned. Comparing aware datetimes that share the same ``tzinfo`` compares
    their wall clocks and ignores ``fold``; that can make the first occurrence
    of a fall-back time look future while it is already past in UTC. Spring-
    forward gap times are skipped for that day (see the module docstring).
    """
    if not enabled or not schedules:
        return None, None

    best: datetime | None = None
    best_instant: datetime | None = None
    best_schedule: dict[str, Any] | None = None
    now_instant = now.astimezone(timezone.utc) if now.tzinfo is not None else now
    for day_offset in range(_MAX_DAY_OFFSET):
        candidate_date = (now + timedelta(days=day_offset)).date()
        weekday = candidate_date.weekday()
        for schedule in schedules:
            if not schedule.get(_KEY_ENABLED, True):
                continue
            # A malformed "days" (not a list/tuple -- e.g. a hand-edited
            # store with a string, int or None) must degrade gracefully
            # like an invalid "time" does below, not raise: `weekday not in
            # <non-container>` throws TypeError, which would crash this
            # whole function (and, via _reschedule_next, the zone's
            # async_setup_entry) for a single corrupted schedule item.
            days = schedule.get(_KEY_DAYS, [])
            if not isinstance(days, (list, tuple)) or weekday not in days:
                continue
            schedule_time = _parse_schedule_time(schedule.get(_KEY_TIME))
            if schedule_time is None:
                continue
            candidate = datetime.combine(
                candidate_date, schedule_time, tzinfo=now.tzinfo
            )
            if not _local_time_exists(candidate):
                continue
            candidate_instant = (
                candidate.astimezone(timezone.utc)
                if candidate.tzinfo is not None
                else candidate
            )
            if candidate_instant <= now_instant:
                continue
            if best_instant is None or candidate_instant < best_instant:
                best = candidate
                best_instant = candidate_instant
                best_schedule = schedule

    return best, best_schedule


def compute_next_run(
    schedules: list[dict[str, Any]],
    now: datetime,
    enabled: bool = True,
) -> datetime | None:
    """Return the next scheduled run datetime, or None if there is none.

    Thin wrapper over :func:`find_next_run` kept for backwards compatibility
    (existing tests / importers).
    """
    next_run, _ = find_next_run(schedules, now, enabled=enabled)
    return next_run


def resolve_target_services(domain: str) -> tuple[str, str, str]:
    """Return ``(service_domain, turn_on_service, turn_off_service)`` for a target domain.

    ``valve`` is actuated through ``valve.open_valve``/``valve.close_valve``
    because ``homeassistant.turn_on``/``turn_off`` do not exist for valves in
    Home Assistant (verified against the 2024.6.0 valve services.yaml).
    ``switch``/``input_boolean``/``light`` go through the ``homeassistant``
    helper services. Any other domain raises ``ValueError`` (the config flow
    only allows the four domains above).
    """
    if domain == "valve":
        return _VALVE_SERVICES
    if domain in _HOMEASSISTANT_DOMAINS:
        return _HOMEASSISTANT_SERVICES
    raise ValueError(f"Unsupported target domain: {domain!r}")


def off_states(domain: str) -> frozenset[str]:
    """Return the states that mean "not actuating" for a target domain.

    ``valve`` reports ``closed`` (never ``off``); the other supported domains
    report ``off``. ``unavailable``/``unknown`` are always treated as not
    actuating. Unknown domains raise ``ValueError``.
    """
    if domain == "valve":
        return _VALVE_OFF_STATES
    if domain in _HOMEASSISTANT_DOMAINS:
        return _HOMEASSISTANT_OFF_STATES
    raise ValueError(f"Unsupported target domain: {domain!r}")


def confirmed_off_states(domain: str) -> frozenset[str]:
    """Return the states that mean the target is CONFIRMED off for a domain.

    Stricter than :func:`off_states`: excludes ``unavailable``/``unknown``.
    A device that stopped reporting is not proof it physically closed, so
    this must never be used to decide whether it is safe to discard the
    restart-recovery safety net. Unknown domains raise ``ValueError``.
    """
    if domain == "valve":
        return _VALVE_CONFIRMED_OFF_STATES
    if domain in _HOMEASSISTANT_DOMAINS:
        return _HOMEASSISTANT_CONFIRMED_OFF_STATES
    raise ValueError(f"Unsupported target domain: {domain!r}")
