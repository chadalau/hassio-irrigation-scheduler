"""Integration tests for reservoir volume tracking (consumption + refill).

Every run that ACTUALLY delivers water (the same fail-safe gate the history
log itself uses) deducts its total volume from the tracked remaining level.
``refill_reservoir`` resets it back to full capacity.
"""

from __future__ import annotations

from datetime import timedelta
from unittest.mock import patch

from homeassistant.const import STATE_OFF, STATE_ON
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
    DOMAIN,
    SERVICE_REFILL_RESERVOIR,
    SERVICE_STOP,
    SERVICE_WATER_NOW,
)

from .conftest import entity_id_of, scheduler_of
from .test_recovery import _base_entry, _populate_store


async def _setup_zone_with_reservoir(hass: HomeAssistant, setup_zone, **overrides):
    options = {
        CONF_ENABLED: True,
        CONF_DEFAULT_DURATION: 600,
        CONF_MAX_DURATION: 7200,
        CONF_SCHEDULES: [],
        CONF_FLOW_RATE_LPH: 8,
        CONF_NUMBER_OF_POTS: 2,
        CONF_RESERVOIR_VOLUME_L: 100,
        **overrides,
    }
    return await setup_zone(target_entity_id="switch.zone1", name="Garden", options=options)


async def test_reservoir_remaining_defaults_to_full_capacity(
    hass: HomeAssistant, setup_zone
) -> None:
    entry = await _setup_zone_with_reservoir(hass, setup_zone)
    scheduler = scheduler_of(entry)
    assert scheduler.reservoir_remaining_l == 100.0


async def test_completed_run_deducts_actual_volume_delivered(
    hass: HomeAssistant, setup_zone, mock_homeassistant_services
) -> None:
    """8 L/h per pot, 2 pots, stopped after a real (short) elapsed time must
    deduct exactly that much -- not the originally requested duration."""
    entry = await _setup_zone_with_reservoir(hass, setup_zone)
    sensor_eid = entity_id_of(hass, entry, "sensor", "next_run")
    scheduler = scheduler_of(entry)

    await hass.services.async_call(
        DOMAIN, SERVICE_WATER_NOW, {"entity_id": sensor_eid, "duration": 600}, blocking=True
    )
    await hass.async_block_till_done()

    stopped_at = scheduler.started_at + timedelta(seconds=90)
    with patch.object(dt_util, "utcnow", return_value=stopped_at):
        await hass.services.async_call(
            DOMAIN, SERVICE_STOP, {"entity_id": sensor_eid}, blocking=True
        )
        await hass.async_block_till_done()

    assert len(scheduler.history) == 1
    actual_duration = scheduler.history[0]["duration"]
    assert actual_duration == 90
    # 8 L/h per pot * 2 pots, for actual_duration seconds.
    expected_liters = (8 / 3600) * actual_duration * 2
    assert scheduler.reservoir_remaining_l == 100.0 - expected_liters


async def test_same_run_uid_is_never_deducted_twice(
    hass: HomeAssistant, setup_zone
) -> None:
    entry = await _setup_zone_with_reservoir(hass, setup_zone)
    scheduler = scheduler_of(entry)

    scheduler._deduct_reservoir_volume(2.5, "stable-run-id")
    await hass.async_block_till_done()
    scheduler._deduct_reservoir_volume(2.5, "stable-run-id")
    await hass.async_block_till_done()

    assert scheduler.reservoir_remaining_l == 97.5


async def test_unconfigured_number_of_pots_deducts_as_one_pot(
    hass: HomeAssistant, setup_zone, mock_homeassistant_services
) -> None:
    """REGRESSION: number_of_pots == 0 means "not configured", same
    convention as the card's totalVolumeMl (utils.ts) which falls back to 1
    pot for display. Before this fix the backend used the raw 0 as the
    multiplier, so reservoir_remaining_l never moved for a zone that left
    number_of_pots unset while flow_rate_lph and reservoir_volume_l WERE
    configured -- even though the card's own history view showed a nonzero
    volume for the same run."""
    entry = await _setup_zone_with_reservoir(
        hass, setup_zone, **{CONF_NUMBER_OF_POTS: 0}
    )
    sensor_eid = entity_id_of(hass, entry, "sensor", "next_run")
    scheduler = scheduler_of(entry)

    await hass.services.async_call(
        DOMAIN, SERVICE_WATER_NOW, {"entity_id": sensor_eid, "duration": 600}, blocking=True
    )
    await hass.async_block_till_done()

    stopped_at = scheduler.started_at + timedelta(seconds=90)
    with patch.object(dt_util, "utcnow", return_value=stopped_at):
        await hass.services.async_call(
            DOMAIN, SERVICE_STOP, {"entity_id": sensor_eid}, blocking=True
        )
        await hass.async_block_till_done()

    assert len(scheduler.history) == 1
    actual_duration = scheduler.history[0]["duration"]
    # 8 L/h per pot, treated as 1 pot (not 0), for actual_duration seconds.
    expected_liters = (8 / 3600) * actual_duration * 1
    assert scheduler.reservoir_remaining_l == 100.0 - expected_liters


async def test_never_actuated_run_does_not_deduct(
    hass: HomeAssistant, setup_zone
) -> None:
    hass.states.async_set("switch.zone1", STATE_OFF)
    # Deliberately no turn_on/turn_off mock: the actuation-grace check will
    # find the target never actuated and abort the run without watering.
    hass.services.async_register("homeassistant", "turn_on", lambda call: None)
    hass.services.async_register("homeassistant", "turn_off", lambda call: None)

    entry = await _setup_zone_with_reservoir(hass, setup_zone)
    sensor_eid = entity_id_of(hass, entry, "sensor", "next_run")
    scheduler = scheduler_of(entry)

    await hass.services.async_call(
        DOMAIN, SERVICE_WATER_NOW, {"entity_id": sensor_eid, "duration": 600}, blocking=True
    )
    await hass.async_block_till_done()
    await hass.services.async_call(
        DOMAIN, SERVICE_STOP, {"entity_id": sensor_eid}, blocking=True
    )
    await hass.async_block_till_done()

    assert scheduler.history == []
    assert scheduler.reservoir_remaining_l == 100.0


async def test_deduction_clamps_at_zero_never_goes_negative(
    hass: HomeAssistant, setup_zone, mock_homeassistant_services
) -> None:
    # Small reservoir, big flow rate: one run easily overdraws it.
    entry = await _setup_zone_with_reservoir(
        hass, setup_zone, **{CONF_RESERVOIR_VOLUME_L: 1, CONF_FLOW_RATE_LPH: 1000}
    )
    sensor_eid = entity_id_of(hass, entry, "sensor", "next_run")
    scheduler = scheduler_of(entry)

    await hass.services.async_call(
        DOMAIN, SERVICE_WATER_NOW, {"entity_id": sensor_eid, "duration": 600}, blocking=True
    )
    await hass.async_block_till_done()

    future = scheduler.finishes_at + timedelta(seconds=1)
    with patch.object(dt_util, "utcnow", return_value=future):
        async_fire_time_changed_exact(hass, future)
        await hass.async_block_till_done()

    assert scheduler.reservoir_remaining_l == 0.0


async def test_refill_reservoir_service_resets_to_full_capacity(
    hass: HomeAssistant, setup_zone, mock_homeassistant_services
) -> None:
    entry = await _setup_zone_with_reservoir(hass, setup_zone)
    sensor_eid = entity_id_of(hass, entry, "sensor", "next_run")
    scheduler = scheduler_of(entry)

    await hass.services.async_call(
        DOMAIN, SERVICE_WATER_NOW, {"entity_id": sensor_eid, "duration": 600}, blocking=True
    )
    await hass.async_block_till_done()

    stopped_at = scheduler.started_at + timedelta(seconds=90)
    with patch.object(dt_util, "utcnow", return_value=stopped_at):
        await hass.services.async_call(
            DOMAIN, SERVICE_STOP, {"entity_id": sensor_eid}, blocking=True
        )
        await hass.async_block_till_done()
    assert scheduler.reservoir_remaining_l < 100.0

    await hass.services.async_call(
        DOMAIN, SERVICE_REFILL_RESERVOIR, {"entity_id": sensor_eid}, blocking=True
    )
    await hass.async_block_till_done()

    assert scheduler.reservoir_remaining_l == 100.0


async def test_no_deduction_when_reservoir_volume_not_configured(
    hass: HomeAssistant, setup_zone, mock_homeassistant_services
) -> None:
    entry = await _setup_zone_with_reservoir(
        hass, setup_zone, **{CONF_RESERVOIR_VOLUME_L: 0}
    )
    sensor_eid = entity_id_of(hass, entry, "sensor", "next_run")
    scheduler = scheduler_of(entry)

    await hass.services.async_call(
        DOMAIN, SERVICE_WATER_NOW, {"entity_id": sensor_eid, "duration": 600}, blocking=True
    )
    await hass.async_block_till_done()
    await hass.services.async_call(
        DOMAIN, SERVICE_STOP, {"entity_id": sensor_eid}, blocking=True
    )
    await hass.async_block_till_done()

    assert len(scheduler.history) == 1
    assert scheduler.reservoir_remaining_l == 0.0


async def test_downtime_expired_recovery_also_deducts(
    hass: HomeAssistant, hass_storage, mock_homeassistant_services
) -> None:
    """The 'expired during downtime' recovery path shares _async_log_history
    with the normal finish path, so it must deduct too."""
    hass.states.async_set("switch.zone1", STATE_ON)

    entry_id = "downtime_reservoir"
    _populate_store(
        hass_storage,
        entry_id,
        {
            "started_at": (dt_util.utcnow() - timedelta(minutes=2)).isoformat(),
            "finishes_at": (dt_util.utcnow() - timedelta(minutes=1)).isoformat(),
            "duration": 60,
            "source": "manual",
            "schedule_id": None,
            # Evidence the target was actually confirmed actuated before the
            # crash -- required for the downtime branch to log/deduct at all.
            "actuated": True,
        },
    )

    entry = _base_entry(entry_id)
    entry.add_to_hass(hass)
    hass.config_entries.async_update_entry(
        entry,
        options={
            **dict(entry.options),
            CONF_FLOW_RATE_LPH: 8,
            CONF_NUMBER_OF_POTS: 2,
            CONF_RESERVOIR_VOLUME_L: 100,
        },
    )
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()

    scheduler = scheduler_of(entry)
    assert len(scheduler.history) == 1
    assert scheduler.reservoir_remaining_l < 100.0
