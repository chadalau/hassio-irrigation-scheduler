"""Integration tests for the schedule_warnings badge on target-actuation
failures -- mirrors the pH gate's warning mechanism (see test_ph_gate.py),
but for "the outlet never turned on" and "the outlet turned off mid-run"
instead of a blocked pH reading. Only SCHEDULED runs are flagged (a manual
water_now failure is immediately visible to whoever just clicked it).
"""

from __future__ import annotations

from datetime import timedelta
from unittest.mock import patch

from homeassistant.const import STATE_OFF, STATE_ON
from homeassistant.core import HomeAssistant, callback
from homeassistant.util import dt as dt_util

from pytest_homeassistant_custom_component.common import async_fire_time_changed_exact

from custom_components.irrigation_scheduler.const import (
    ACTUATION_GRACE,
    CONF_DEFAULT_DURATION,
    CONF_ENABLED,
    CONF_MAX_DURATION,
    CONF_SCHEDULES,
    SERVICE_WATER_NOW,
)

from .conftest import entity_id_of, scheduler_of

_DAILY_SCHEDULE = [
    {
        "id": "daily-06",
        "time": "06:00:00",
        "days": [0, 1, 2, 3, 4, 5, 6],
        "duration": 900,
        "enabled": True,
    }
]


async def _setup_scheduled_zone(hass: HomeAssistant, setup_zone):
    return await setup_zone(
        target_entity_id="switch.zone1",
        name="Garden",
        options={
            CONF_ENABLED: True,
            CONF_DEFAULT_DURATION: 600,
            CONF_MAX_DURATION: 7200,
            CONF_SCHEDULES: list(_DAILY_SCHEDULE),
        },
    )


async def test_scheduled_run_never_actuating_flags_warning(
    hass: HomeAssistant, setup_zone, async_device
) -> None:
    """turn_on is sent but the target never leaves its off state: after
    ACTUATION_GRACE the run is aborted and the schedule is flagged."""
    async_device.set_state("switch.zone1", STATE_OFF)
    entry = await _setup_scheduled_zone(hass, setup_zone)
    scheduler = scheduler_of(entry)
    assert scheduler.next_run is not None

    async_fire_time_changed_exact(hass, scheduler.next_run)
    await hass.async_block_till_done()
    assert scheduler.is_watering
    assert scheduler.started_at is not None

    async_fire_time_changed_exact(
        hass, scheduler.started_at + timedelta(seconds=ACTUATION_GRACE + 1)
    )
    await hass.async_block_till_done()

    assert not scheduler.is_watering
    assert "daily-06" in scheduler.schedule_warnings
    assert "não ligou" in scheduler.schedule_warnings["daily-06"]


async def test_scheduled_run_turn_on_raising_flags_warning(
    hass: HomeAssistant, setup_zone
) -> None:
    """turn_on itself raises (device unreachable): the run never starts and
    the schedule is flagged, same as the grace-expired case."""
    hass.states.async_set("switch.zone1", STATE_OFF)

    def _raising_turn_on(call):
        raise RuntimeError("device unreachable")

    hass.services.async_register("homeassistant", "turn_on", _raising_turn_on)
    hass.services.async_register("homeassistant", "turn_off", lambda call: None)

    entry = await _setup_scheduled_zone(hass, setup_zone)
    scheduler = scheduler_of(entry)
    assert scheduler.next_run is not None

    async_fire_time_changed_exact(hass, scheduler.next_run)
    await hass.async_block_till_done()

    assert not scheduler.is_watering
    assert "daily-06" in scheduler.schedule_warnings
    assert "não ligou" in scheduler.schedule_warnings["daily-06"]


async def test_scheduled_run_stopped_externally_mid_run_flags_warning(
    hass: HomeAssistant, setup_zone, mock_homeassistant_services
) -> None:
    """The target actuates normally, then reports a CONFIRMED off state
    before finishes_at (e.g. it lost power): the run ends early and the
    schedule is flagged with a different message than the never-actuated
    case."""
    hass.states.async_set("switch.zone1", STATE_OFF)
    entry = await _setup_scheduled_zone(hass, setup_zone)
    scheduler = scheduler_of(entry)
    assert scheduler.next_run is not None

    async_fire_time_changed_exact(hass, scheduler.next_run)
    await hass.async_block_till_done()
    assert scheduler.is_watering
    assert hass.states.get("switch.zone1").state == STATE_ON
    assert scheduler.started_at is not None

    # Past the actuation grace window, so this is no longer treated as a
    # stale echo -- but well before finishes_at (schedule duration is 900s).
    future = scheduler.started_at + timedelta(seconds=ACTUATION_GRACE + 30)
    with patch.object(dt_util, "utcnow", return_value=future):
        hass.states.async_set("switch.zone1", STATE_OFF)
        await hass.async_block_till_done()

    assert not scheduler.is_watering
    assert "daily-06" in scheduler.schedule_warnings
    assert "desligou durante a rega" in scheduler.schedule_warnings["daily-06"]
    # It DID deliver some water, unlike the never-actuated case: still
    # logged to history with the real (short) elapsed duration.
    assert len(scheduler.history) == 1


async def test_manual_water_now_failure_does_not_flag_a_schedule_warning(
    hass: HomeAssistant, setup_zone, async_device
) -> None:
    """A manual water_now that never actuates must NOT touch
    schedule_warnings -- that badge is scoped to SCHEDULED runs only,
    mirroring the pH gate's own manual-water_now exclusion."""
    async_device.set_state("switch.zone1", STATE_OFF)
    entry = await _setup_scheduled_zone(hass, setup_zone)
    scheduler = scheduler_of(entry)
    sensor_eid = entity_id_of(hass, entry, "sensor", "next_run")

    await hass.services.async_call(
        "irrigation_scheduler",
        SERVICE_WATER_NOW,
        {"entity_id": sensor_eid, "duration": 60},
        blocking=True,
    )
    await hass.async_block_till_done()
    assert scheduler.is_watering
    assert scheduler.started_at is not None

    async_fire_time_changed_exact(
        hass, scheduler.started_at + timedelta(seconds=ACTUATION_GRACE + 1)
    )
    await hass.async_block_till_done()

    assert not scheduler.is_watering
    assert scheduler.schedule_warnings == {}


async def test_starting_the_schedule_again_clears_a_previous_warning(
    hass: HomeAssistant, setup_zone, mock_homeassistant_services
) -> None:
    """A stale warning from a previous failed firing must not linger once
    that schedule successfully starts a run again -- same self-healing
    behavior as the pH gate's warning."""
    hass.states.async_set("switch.zone1", STATE_OFF)
    entry = await _setup_scheduled_zone(hass, setup_zone)
    scheduler = scheduler_of(entry)
    scheduler._schedule_warnings["daily-06"] = "Tomada não ligou (verifique energia/conexão)"  # noqa: SLF001
    assert scheduler.next_run is not None

    async_fire_time_changed_exact(hass, scheduler.next_run)
    await hass.async_block_till_done()

    assert scheduler.is_watering
    assert "daily-06" not in scheduler.schedule_warnings
