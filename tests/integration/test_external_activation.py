"""Integration tests for detecting a target actuated OUTSIDE the
integration (physical button, the device's own app, another automation)
while no run is tracked. Treated like a water_now with the zone's
default_duration -- see IrrigationScheduler._async_start_external_run.
"""

from __future__ import annotations

from datetime import timedelta
from unittest.mock import patch

from homeassistant.const import STATE_OFF, STATE_ON, STATE_UNAVAILABLE
from homeassistant.core import HomeAssistant
from homeassistant.util import dt as dt_util
from pytest_homeassistant_custom_component.common import async_fire_time_changed_exact

from custom_components.irrigation_scheduler.const import (
    CONF_DEFAULT_DURATION,
    CONF_ENABLED,
    CONF_FLOW_RATE_LPH,
    CONF_MAX_DURATION,
    CONF_NUMBER_OF_POTS,
    CONF_RESERVOIR_VOLUME_L,
    CONF_SCHEDULES,
)

from .conftest import entity_id_of, scheduler_of


async def _setup_zone(hass: HomeAssistant, setup_zone, **overrides):
    options = {
        CONF_ENABLED: True,
        CONF_DEFAULT_DURATION: 5,
        CONF_MAX_DURATION: 7200,
        CONF_SCHEDULES: [],
        CONF_FLOW_RATE_LPH: 8,
        CONF_NUMBER_OF_POTS: 2,
        CONF_RESERVOIR_VOLUME_L: 100,
        **overrides,
    }
    return await setup_zone(target_entity_id="switch.zone1", name="Garden", options=options)


async def test_external_actuation_is_tracked_as_a_run(
    hass: HomeAssistant, setup_zone, mock_homeassistant_services
) -> None:
    hass.states.async_set("switch.zone1", STATE_OFF)
    entry = await _setup_zone(hass, setup_zone)
    scheduler = scheduler_of(entry)
    binary_eid = entity_id_of(hass, entry, "binary_sensor", "watering")

    hass.states.async_set("switch.zone1", STATE_ON)
    await hass.async_block_till_done()

    assert scheduler.is_watering
    assert scheduler.active_source == "external"
    assert scheduler.active_schedule_id is None
    assert scheduler.finishes_at is not None
    assert scheduler.started_at is not None
    expected_finish = scheduler.started_at + timedelta(seconds=5)
    assert abs((scheduler.finishes_at - expected_finish).total_seconds()) < 1

    binary_state = hass.states.get(binary_eid)
    assert binary_state is not None
    assert binary_state.state == "on"
    assert binary_state.attributes["source"] == "external"


async def test_external_run_stop_timer_turns_off_after_default_duration(
    hass: HomeAssistant, setup_zone, mock_homeassistant_services
) -> None:
    hass.states.async_set("switch.zone1", STATE_OFF)
    entry = await _setup_zone(hass, setup_zone)
    scheduler = scheduler_of(entry)

    hass.states.async_set("switch.zone1", STATE_ON)
    await hass.async_block_till_done()
    assert scheduler.is_watering
    assert scheduler.finishes_at is not None

    finishes_at = scheduler.finishes_at
    with patch.object(dt_util, "utcnow", return_value=finishes_at):
        async_fire_time_changed_exact(hass, finishes_at + timedelta(seconds=1))
        await hass.async_block_till_done()

    assert not scheduler.is_watering
    assert hass.states.get("switch.zone1").state == STATE_OFF
    assert len(scheduler.history) == 1
    record = scheduler.history[0]
    assert record["source"] == "external"
    assert record["schedule_id"] is None
    assert record["duration"] == 5
    # 8 L/h per pot * 2 pots for 5s.
    expected_liters = (8 / 3600) * 5 * 2
    assert scheduler.reservoir_remaining_l == 100.0 - expected_liters


async def test_external_run_stopped_early_logs_actual_elapsed_duration(
    hass: HomeAssistant, setup_zone, mock_homeassistant_services
) -> None:
    """If whoever turned it on also turns it off early, the run still gets
    logged (it delivered water) with the REAL elapsed duration."""
    hass.states.async_set("switch.zone1", STATE_OFF)
    entry = await _setup_zone(
        hass, setup_zone, **{CONF_DEFAULT_DURATION: 600}
    )
    scheduler = scheduler_of(entry)

    hass.states.async_set("switch.zone1", STATE_ON)
    await hass.async_block_till_done()
    assert scheduler.is_watering
    assert scheduler.started_at is not None

    stopped_at = scheduler.started_at + timedelta(seconds=90)
    with patch.object(dt_util, "utcnow", return_value=stopped_at):
        hass.states.async_set("switch.zone1", STATE_OFF)
        await hass.async_block_till_done()

    assert not scheduler.is_watering
    assert len(scheduler.history) == 1
    assert scheduler.history[0]["source"] == "external"
    assert scheduler.history[0]["duration"] == 90


async def test_unavailable_target_does_not_start_an_external_run(
    hass: HomeAssistant, setup_zone
) -> None:
    hass.states.async_set("switch.zone1", STATE_OFF)
    entry = await _setup_zone(hass, setup_zone)
    scheduler = scheduler_of(entry)

    hass.states.async_set("switch.zone1", STATE_UNAVAILABLE)
    await hass.async_block_till_done()

    assert not scheduler.is_watering


async def test_our_own_turn_on_is_not_misdetected_as_external(
    hass: HomeAssistant, setup_zone, mock_homeassistant_services
) -> None:
    """A normal water_now-triggered actuation must remain source=manual, not
    get overwritten/duplicated by the external-activation detection."""
    from custom_components.irrigation_scheduler.const import DOMAIN, SERVICE_WATER_NOW

    hass.states.async_set("switch.zone1", STATE_OFF)
    entry = await _setup_zone(hass, setup_zone)
    scheduler = scheduler_of(entry)
    sensor_eid = entity_id_of(hass, entry, "sensor", "next_run")

    await hass.services.async_call(
        DOMAIN, SERVICE_WATER_NOW, {"entity_id": sensor_eid, "duration": 60}, blocking=True
    )
    await hass.async_block_till_done()

    assert scheduler.is_watering
    assert scheduler.active_source == "manual"


async def test_store_save_failure_keeps_in_memory_watchdog(
    hass: HomeAssistant, setup_zone, mock_homeassistant_services
) -> None:
    hass.states.async_set("switch.zone1", STATE_OFF)
    entry = await _setup_zone(hass, setup_zone)
    scheduler = scheduler_of(entry)

    with patch.object(
        scheduler.store, "async_create_entry", side_effect=RuntimeError("disk full")
    ):
        hass.states.async_set("switch.zone1", STATE_ON)
        await hass.async_block_till_done()

    assert scheduler.is_watering
    assert scheduler.finishes_at is not None
    assert hass.states.get("switch.zone1").state == STATE_ON

    finishes_at = scheduler.finishes_at
    with patch.object(dt_util, "utcnow", return_value=finishes_at):
        async_fire_time_changed_exact(hass, finishes_at + timedelta(seconds=1))
        await hass.async_block_till_done()

    assert not scheduler.is_watering
    assert hass.states.get("switch.zone1").state == STATE_OFF


async def test_target_already_on_at_setup_is_reconciled(
    hass: HomeAssistant, setup_zone, mock_homeassistant_services
) -> None:
    hass.states.async_set("switch.zone1", STATE_ON)

    entry = await _setup_zone(hass, setup_zone)
    scheduler = scheduler_of(entry)

    assert scheduler.is_watering
    assert scheduler.active_source == "external"
    assert scheduler.finishes_at is not None


async def test_stop_defensively_turns_off_untracked_target(
    hass: HomeAssistant, setup_zone, mock_homeassistant_services
) -> None:
    hass.states.async_set("switch.zone1", STATE_OFF)
    entry = await _setup_zone(hass, setup_zone)
    scheduler = scheduler_of(entry)
    scheduler._unsub_state()
    scheduler._unsub_state = None
    hass.states.async_set("switch.zone1", STATE_ON)
    await hass.async_block_till_done()
    assert not scheduler.is_watering

    await scheduler.async_stop()

    assert hass.states.get("switch.zone1").state == STATE_OFF


async def test_external_stop_inside_grace_logs_actual_duration(
    hass: HomeAssistant, setup_zone, mock_homeassistant_services
) -> None:
    hass.states.async_set("switch.zone1", STATE_OFF)
    entry = await _setup_zone(hass, setup_zone, **{CONF_DEFAULT_DURATION: 600})
    scheduler = scheduler_of(entry)
    hass.states.async_set("switch.zone1", STATE_ON)
    await hass.async_block_till_done()
    stopped_at = scheduler.started_at + timedelta(seconds=1)

    with patch.object(dt_util, "utcnow", return_value=stopped_at):
        hass.states.async_set("switch.zone1", STATE_OFF)
        await hass.async_block_till_done()

    assert not scheduler.is_watering
    assert scheduler.history[0]["duration"] == 1


async def test_external_run_survives_restart_recovery(
    hass: HomeAssistant, setup_zone, mock_homeassistant_services
) -> None:
    """A plain reload deliberately ENDS an active run (see async_unload) --
    only a real HA shutdown (CoreState.stopping) preserves it for the next
    boot to resume, so that is what this simulates."""
    from homeassistant.core import CoreState

    entry = await _setup_zone(
        hass, setup_zone, **{CONF_DEFAULT_DURATION: 600}
    )
    hass.states.async_set("switch.zone1", STATE_ON)
    await hass.async_block_till_done()
    scheduler = scheduler_of(entry)
    assert scheduler.is_watering
    assert scheduler.active_source == "external"

    hass.set_state(CoreState.stopping)
    try:
        assert await hass.config_entries.async_unload(entry.entry_id)
        await hass.async_block_till_done()
    finally:
        hass.set_state(CoreState.running)

    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()

    resumed = scheduler_of(entry)
    assert resumed.is_watering
    assert resumed.active_source == "external"
