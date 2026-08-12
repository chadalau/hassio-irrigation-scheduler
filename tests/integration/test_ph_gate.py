"""Integration tests for the optional per-zone pH gate.

The pH gate only affects SCHEDULED firings (``_async_schedule_fired``):
``water_now`` is always an explicit manual override and bypasses it. It is
fail-safe: a missing/unavailable/unparseable sensor blocks the run rather
than watering blindly. A skipped firing is remembered per-schedule-id so the
sensor (and therefore the card) can flag it, and clears the next time that
schedule successfully starts a run.
"""

from __future__ import annotations

from datetime import timedelta
from unittest.mock import patch

import pytest
import voluptuous as vol
from homeassistant.const import STATE_OFF, STATE_ON
from homeassistant.core import HomeAssistant
from homeassistant.util import dt as dt_util

from pytest_homeassistant_custom_component.common import async_fire_time_changed_exact

from custom_components.irrigation_scheduler.const import (
    CONF_ENABLED,
    CONF_DEFAULT_DURATION,
    CONF_MAX_DURATION,
    CONF_PH_ENTITY_ID,
    CONF_PH_MAX,
    CONF_PH_MIN,
    CONF_SCHEDULES,
    DOMAIN,
    SERVICE_SET_ZONE_OPTIONS,
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


async def _setup_ph_zone(hass: HomeAssistant, setup_zone, **ph_options):
    return await setup_zone(
        target_entity_id="switch.zone1",
        name="Garden",
        options={
            CONF_ENABLED: True,
            CONF_DEFAULT_DURATION: 600,
            CONF_MAX_DURATION: 7200,
            CONF_SCHEDULES: list(_DAILY_SCHEDULE),
            **ph_options,
        },
    )


async def test_set_zone_options_updates_ph_gate(
    hass: HomeAssistant, setup_zone
) -> None:
    """set_zone_options stores ph_entity_id/ph_min/ph_max and exposes them."""
    entry = await setup_zone(target_entity_id="switch.zone1", name="Garden")
    sensor_eid = entity_id_of(hass, entry, "sensor", "next_run")
    assert sensor_eid

    await hass.services.async_call(
        DOMAIN,
        SERVICE_SET_ZONE_OPTIONS,
        {
            "entity_id": sensor_eid,
            CONF_PH_ENTITY_ID: "sensor.reservoir_ph",
            CONF_PH_MIN: 5.5,
            CONF_PH_MAX: 6.5,
        },
        blocking=True,
    )
    await hass.async_block_till_done()

    scheduler = scheduler_of(entry)
    assert scheduler.ph_entity_id == "sensor.reservoir_ph"
    assert scheduler.ph_min == 5.5
    assert scheduler.ph_max == 6.5

    state = hass.states.get(sensor_eid)
    assert state is not None
    assert state.attributes[CONF_PH_ENTITY_ID] == "sensor.reservoir_ph"
    assert state.attributes[CONF_PH_MIN] == 5.5
    assert state.attributes[CONF_PH_MAX] == 6.5


async def test_set_zone_options_can_disable_ph_gate_with_empty_string(
    hass: HomeAssistant, setup_zone
) -> None:
    """An explicit empty string disables the gate (distinct from "unchanged")."""
    entry = await setup_zone(target_entity_id="switch.zone1", name="Garden")
    sensor_eid = entity_id_of(hass, entry, "sensor", "next_run")
    assert sensor_eid

    await hass.services.async_call(
        DOMAIN,
        SERVICE_SET_ZONE_OPTIONS,
        {"entity_id": sensor_eid, CONF_PH_ENTITY_ID: "sensor.reservoir_ph"},
        blocking=True,
    )
    await hass.async_block_till_done()
    assert scheduler_of(entry).ph_entity_id == "sensor.reservoir_ph"

    await hass.services.async_call(
        DOMAIN,
        SERVICE_SET_ZONE_OPTIONS,
        {"entity_id": sensor_eid, CONF_PH_ENTITY_ID: ""},
        blocking=True,
    )
    await hass.async_block_till_done()
    assert scheduler_of(entry).ph_entity_id == ""


async def test_set_zone_options_rejects_ph_min_above_ph_max(
    hass: HomeAssistant, setup_zone
) -> None:
    """A single call setting ph_min > ph_max is rejected."""
    entry = await setup_zone(target_entity_id="switch.zone1", name="Garden")
    sensor_eid = entity_id_of(hass, entry, "sensor", "next_run")
    assert sensor_eid

    with pytest.raises(vol.error.Invalid):
        await hass.services.async_call(
            DOMAIN,
            SERVICE_SET_ZONE_OPTIONS,
            {"entity_id": sensor_eid, CONF_PH_MIN: 7.0, CONF_PH_MAX: 6.0},
            blocking=True,
        )
    await hass.async_block_till_done()
    # Nothing was stored: options are untouched (still the defaults).
    assert scheduler_of(entry).ph_min == 0.0
    assert scheduler_of(entry).ph_max == 14.0


async def test_set_zone_options_rejects_ph_out_of_scale(
    hass: HomeAssistant, setup_zone
) -> None:
    """ph_min/ph_max must stay within the 0..14 pH scale."""
    entry = await setup_zone(target_entity_id="switch.zone1", name="Garden")
    sensor_eid = entity_id_of(hass, entry, "sensor", "next_run")
    assert sensor_eid

    with pytest.raises(vol.error.MultipleInvalid):
        await hass.services.async_call(
            DOMAIN,
            SERVICE_SET_ZONE_OPTIONS,
            {"entity_id": sensor_eid, CONF_PH_MAX: 15},
            blocking=True,
        )
    await hass.async_block_till_done()


async def test_scheduled_run_starts_when_ph_within_range(
    hass: HomeAssistant, setup_zone, mock_homeassistant_services
) -> None:
    """A scheduled firing proceeds normally when the pH reading is in range."""
    hass.states.async_set("switch.zone1", STATE_OFF)
    hass.states.async_set("sensor.reservoir_ph", "6.0")
    entry = await _setup_ph_zone(
        hass,
        setup_zone,
        **{
            CONF_PH_ENTITY_ID: "sensor.reservoir_ph",
            CONF_PH_MIN: 5.5,
            CONF_PH_MAX: 6.5,
        },
    )
    scheduler = scheduler_of(entry)
    assert scheduler.next_run is not None

    async_fire_time_changed_exact(hass, scheduler.next_run)
    await hass.async_block_till_done()

    assert scheduler.is_watering
    assert hass.states.get("switch.zone1").state == STATE_ON
    assert scheduler.schedule_warnings == {}


async def test_scheduled_run_skipped_when_ph_outside_range_flags_warning(
    hass: HomeAssistant, setup_zone, mock_homeassistant_services
) -> None:
    """A scheduled firing is skipped (no watering) when pH is out of range."""
    hass.states.async_set("switch.zone1", STATE_OFF)
    hass.states.async_set("sensor.reservoir_ph", "7.8")
    entry = await _setup_ph_zone(
        hass,
        setup_zone,
        **{
            CONF_PH_ENTITY_ID: "sensor.reservoir_ph",
            CONF_PH_MIN: 5.5,
            CONF_PH_MAX: 6.5,
        },
    )
    sensor_eid = entity_id_of(hass, entry, "sensor", "next_run")
    scheduler = scheduler_of(entry)
    assert scheduler.next_run is not None

    async_fire_time_changed_exact(hass, scheduler.next_run)
    await hass.async_block_till_done()

    assert not scheduler.is_watering
    assert hass.states.get("switch.zone1").state == STATE_OFF
    assert "daily-06" in scheduler.schedule_warnings
    assert "7.8" in scheduler.schedule_warnings["daily-06"]

    state = hass.states.get(sensor_eid)
    assert state is not None
    assert "daily-06" in state.attributes["schedule_warnings"]


@pytest.mark.parametrize("sensor_state", ["unavailable", "unknown", "not-a-number"])
async def test_scheduled_run_skipped_when_ph_sensor_unusable(
    hass: HomeAssistant, setup_zone, mock_homeassistant_services, sensor_state
) -> None:
    """A missing/unavailable/unparseable pH reading fails SAFE: no watering."""
    hass.states.async_set("switch.zone1", STATE_OFF)
    hass.states.async_set("sensor.reservoir_ph", sensor_state)
    entry = await _setup_ph_zone(
        hass,
        setup_zone,
        **{CONF_PH_ENTITY_ID: "sensor.reservoir_ph", CONF_PH_MIN: 5.5, CONF_PH_MAX: 6.5},
    )
    scheduler = scheduler_of(entry)
    assert scheduler.next_run is not None

    async_fire_time_changed_exact(hass, scheduler.next_run)
    await hass.async_block_till_done()

    assert not scheduler.is_watering
    assert hass.states.get("switch.zone1").state == STATE_OFF
    assert "daily-06" in scheduler.schedule_warnings


async def test_water_now_ignores_ph_gate(
    hass: HomeAssistant, setup_zone, mock_homeassistant_services
) -> None:
    """A manual water_now always proceeds, even with pH far out of range."""
    hass.states.async_set("switch.zone1", STATE_OFF)
    hass.states.async_set("sensor.reservoir_ph", "9.0")
    entry = await _setup_ph_zone(
        hass,
        setup_zone,
        **{CONF_PH_ENTITY_ID: "sensor.reservoir_ph", CONF_PH_MIN: 5.5, CONF_PH_MAX: 6.5},
    )
    sensor_eid = entity_id_of(hass, entry, "sensor", "next_run")
    assert sensor_eid

    await hass.services.async_call(
        DOMAIN, SERVICE_WATER_NOW, {"entity_id": sensor_eid}, blocking=True
    )
    await hass.async_block_till_done()

    scheduler = scheduler_of(entry)
    assert scheduler.is_watering
    assert hass.states.get("switch.zone1").state == STATE_ON
    assert scheduler.schedule_warnings == {}


async def test_warning_clears_after_next_successful_scheduled_fire(
    hass: HomeAssistant, setup_zone, mock_homeassistant_services
) -> None:
    """A skipped schedule's warning clears once it waters successfully."""
    hass.states.async_set("switch.zone1", STATE_OFF)
    hass.states.async_set("sensor.reservoir_ph", "7.8")
    entry = await _setup_ph_zone(
        hass,
        setup_zone,
        **{CONF_PH_ENTITY_ID: "sensor.reservoir_ph", CONF_PH_MIN: 5.5, CONF_PH_MAX: 6.5},
    )
    scheduler = scheduler_of(entry)
    first_fire = scheduler.next_run
    assert first_fire is not None

    # ``async_fire_time_changed_exact`` only fakes the SPECIFIC timer's own
    # firing check; ``_reschedule_next()`` calls ``dt_util.now()`` directly
    # (outside that machinery) to compute the FOLLOWING occurrence, so the
    # simulated clock must be patched too -- same pattern as
    # test_recovery.py's ``patch("homeassistant.util.dt.utcnow", ...)``.
    with (
        patch("homeassistant.util.dt.now") as mock_now,
        patch("homeassistant.util.dt.utcnow") as mock_utcnow,
    ):
        mock_now.return_value = first_fire
        mock_utcnow.return_value = dt_util.as_utc(first_fire)
        async_fire_time_changed_exact(hass, first_fire)
        await hass.async_block_till_done()

        assert not scheduler.is_watering
        assert "daily-06" in scheduler.schedule_warnings

        # pH recovers before the NEXT scheduled firing (same schedule, next
        # day, since _reschedule_next() already rolled next_run forward).
        hass.states.async_set("sensor.reservoir_ph", "6.0")
        second_fire = scheduler.next_run
        assert second_fire is not None
        assert second_fire > first_fire

        mock_now.return_value = second_fire
        mock_utcnow.return_value = dt_util.as_utc(second_fire)
        async_fire_time_changed_exact(hass, second_fire)
        await hass.async_block_till_done()

    assert scheduler.is_watering
    assert hass.states.get("switch.zone1").state == STATE_ON
    assert scheduler.schedule_warnings == {}


async def test_ph_gate_disabled_when_entity_id_not_configured(
    hass: HomeAssistant, setup_zone, mock_homeassistant_services
) -> None:
    """The default (no ph_entity_id) never gates a scheduled run."""
    hass.states.async_set("switch.zone1", STATE_OFF)
    entry = await _setup_ph_zone(hass, setup_zone)
    scheduler = scheduler_of(entry)
    assert scheduler.ph_entity_id == ""
    assert scheduler.next_run is not None

    async_fire_time_changed_exact(hass, scheduler.next_run)
    await hass.async_block_till_done()

    assert scheduler.is_watering
    assert hass.states.get("switch.zone1").state == STATE_ON
