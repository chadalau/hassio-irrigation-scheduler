"""Integration tests for the SECOND (independent) reservoir's pH gate.

A single target/pump can draw from two physically distinct reservoirs (e.g.
one outlet feeding two tanks), each with its own pH/EC. R2 is fully optional
and independent of R1: when configured, a SCHEDULED run only starts if BOTH
reservoirs read within their own range (see
IrrigationScheduler._check_ph_gate). ``water_now`` always bypasses both,
exactly like R1.
"""

from __future__ import annotations

import pytest
from homeassistant.const import STATE_OFF, STATE_ON
from homeassistant.core import HomeAssistant
from homeassistant.exceptions import ServiceValidationError
from pytest_homeassistant_custom_component.common import async_fire_time_changed_exact

from custom_components.irrigation_scheduler.const import (
    CONF_DEFAULT_DURATION,
    CONF_EC_ENTITY_ID_2,
    CONF_ENABLED,
    CONF_MAX_DURATION,
    CONF_PH_ENTITY_ID,
    CONF_PH_ENTITY_ID_2,
    CONF_PH_MAX,
    CONF_PH_MAX_2,
    CONF_PH_MIN,
    CONF_PH_MIN_2,
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


async def _setup_zone(hass: HomeAssistant, setup_zone, **options):
    return await setup_zone(
        target_entity_id="switch.zone1",
        name="Garden",
        options={
            CONF_ENABLED: True,
            CONF_DEFAULT_DURATION: 600,
            CONF_MAX_DURATION: 7200,
            CONF_SCHEDULES: list(_DAILY_SCHEDULE),
            **options,
        },
    )


async def test_set_zone_options_updates_r2_ph_gate(
    hass: HomeAssistant, setup_zone
) -> None:
    entry = await setup_zone(target_entity_id="switch.zone1", name="Garden")
    sensor_eid = entity_id_of(hass, entry, "sensor", "next_run")
    assert sensor_eid

    await hass.services.async_call(
        DOMAIN,
        SERVICE_SET_ZONE_OPTIONS,
        {
            "entity_id": sensor_eid,
            CONF_PH_ENTITY_ID_2: "sensor.reservoir2_ph",
            CONF_PH_MIN_2: 5.8,
            CONF_PH_MAX_2: 6.8,
            CONF_EC_ENTITY_ID_2: "sensor.reservoir2_ec",
        },
        blocking=True,
    )
    await hass.async_block_till_done()

    scheduler = scheduler_of(entry)
    assert scheduler.ph_entity_id_2 == "sensor.reservoir2_ph"
    assert scheduler.ph_min_2 == 5.8
    assert scheduler.ph_max_2 == 6.8
    assert scheduler.ec_entity_id_2 == "sensor.reservoir2_ec"
    # R1 untouched.
    assert scheduler.ph_entity_id == ""


async def test_set_zone_options_rejects_r2_ph_min_above_max(
    hass: HomeAssistant, setup_zone
) -> None:
    entry = await setup_zone(target_entity_id="switch.zone1", name="Garden")
    sensor_eid = entity_id_of(hass, entry, "sensor", "next_run")
    assert sensor_eid

    with pytest.raises(ServiceValidationError):
        await hass.services.async_call(
            DOMAIN,
            SERVICE_SET_ZONE_OPTIONS,
            {
                "entity_id": sensor_eid,
                CONF_PH_MIN_2: 7.0,
                CONF_PH_MAX_2: 5.0,
            },
            blocking=True,
        )


async def test_scheduled_run_starts_when_both_reservoirs_within_range(
    hass: HomeAssistant, setup_zone, mock_homeassistant_services
) -> None:
    hass.states.async_set("switch.zone1", STATE_OFF)
    hass.states.async_set("sensor.reservoir1_ph", "6.0")
    hass.states.async_set("sensor.reservoir2_ph", "6.2")
    entry = await _setup_zone(
        hass,
        setup_zone,
        **{
            CONF_PH_ENTITY_ID: "sensor.reservoir1_ph",
            CONF_PH_MIN: 5.5,
            CONF_PH_MAX: 6.5,
            CONF_PH_ENTITY_ID_2: "sensor.reservoir2_ph",
            CONF_PH_MIN_2: 5.8,
            CONF_PH_MAX_2: 6.8,
        },
    )
    scheduler = scheduler_of(entry)
    assert scheduler.next_run is not None

    async_fire_time_changed_exact(hass, scheduler.next_run)
    await hass.async_block_till_done()

    assert scheduler.is_watering
    assert hass.states.get("switch.zone1").state == STATE_ON
    assert scheduler.schedule_warnings == {}


async def test_scheduled_run_skipped_when_r2_out_of_range_even_if_r1_ok(
    hass: HomeAssistant, setup_zone, mock_homeassistant_services
) -> None:
    """The exact scenario reported by the user: one pump feeds two tanks,
    R1 is fine but R2 is out of range -- the run must NOT start."""
    hass.states.async_set("switch.zone1", STATE_OFF)
    hass.states.async_set("sensor.reservoir1_ph", "6.0")
    hass.states.async_set("sensor.reservoir2_ph", "8.0")
    entry = await _setup_zone(
        hass,
        setup_zone,
        **{
            CONF_PH_ENTITY_ID: "sensor.reservoir1_ph",
            CONF_PH_MIN: 5.5,
            CONF_PH_MAX: 6.5,
            CONF_PH_ENTITY_ID_2: "sensor.reservoir2_ph",
            CONF_PH_MIN_2: 5.8,
            CONF_PH_MAX_2: 6.8,
        },
    )
    scheduler = scheduler_of(entry)
    assert scheduler.next_run is not None

    async_fire_time_changed_exact(hass, scheduler.next_run)
    await hass.async_block_till_done()

    assert not scheduler.is_watering
    assert hass.states.get("switch.zone1").state == STATE_OFF
    assert "daily-06" in scheduler.schedule_warnings
    assert "R2" in scheduler.schedule_warnings["daily-06"]


async def test_scheduled_run_skipped_when_r1_out_of_range_even_if_r2_ok(
    hass: HomeAssistant, setup_zone, mock_homeassistant_services
) -> None:
    hass.states.async_set("switch.zone1", STATE_OFF)
    hass.states.async_set("sensor.reservoir1_ph", "8.0")
    hass.states.async_set("sensor.reservoir2_ph", "6.2")
    entry = await _setup_zone(
        hass,
        setup_zone,
        **{
            CONF_PH_ENTITY_ID: "sensor.reservoir1_ph",
            CONF_PH_MIN: 5.5,
            CONF_PH_MAX: 6.5,
            CONF_PH_ENTITY_ID_2: "sensor.reservoir2_ph",
            CONF_PH_MIN_2: 5.8,
            CONF_PH_MAX_2: 6.8,
        },
    )
    scheduler = scheduler_of(entry)
    assert scheduler.next_run is not None

    async_fire_time_changed_exact(hass, scheduler.next_run)
    await hass.async_block_till_done()

    assert not scheduler.is_watering
    assert "daily-06" in scheduler.schedule_warnings
    assert "R1" in scheduler.schedule_warnings["daily-06"]


async def test_disabling_r2_gate_does_not_clear_r1_warning(
    hass: HomeAssistant, setup_zone, mock_homeassistant_services
) -> None:
    """REGRESSION: async_set_zone_options clearing a reservoir's own stale
    warnings on disable must not also wipe the OTHER reservoir's still-valid
    warning. Before this fix, disabling ph_entity_id_2 (or ph_entity_id)
    cleared schedule_warnings entirely regardless of which reservoir it
    actually belonged to."""
    hass.states.async_set("switch.zone1", STATE_OFF)
    hass.states.async_set("sensor.reservoir1_ph", "8.0")  # out of range
    hass.states.async_set("sensor.reservoir2_ph", "6.2")
    entry = await _setup_zone(
        hass,
        setup_zone,
        **{
            CONF_PH_ENTITY_ID: "sensor.reservoir1_ph",
            CONF_PH_MIN: 5.5,
            CONF_PH_MAX: 6.5,
            CONF_PH_ENTITY_ID_2: "sensor.reservoir2_ph",
            CONF_PH_MIN_2: 5.8,
            CONF_PH_MAX_2: 6.8,
        },
    )
    scheduler = scheduler_of(entry)
    sensor_eid = entity_id_of(hass, entry, "sensor", "next_run")
    assert scheduler.next_run is not None

    async_fire_time_changed_exact(hass, scheduler.next_run)
    await hass.async_block_till_done()

    assert "daily-06" in scheduler.schedule_warnings
    assert "R1" in scheduler.schedule_warnings["daily-06"]

    # Disable R2's gate -- R1's still-valid warning must survive.
    await hass.services.async_call(
        DOMAIN,
        SERVICE_SET_ZONE_OPTIONS,
        {"entity_id": sensor_eid, CONF_PH_ENTITY_ID_2: ""},
        blocking=True,
    )
    await hass.async_block_till_done()

    assert "daily-06" in scheduler.schedule_warnings
    assert "R1" in scheduler.schedule_warnings["daily-06"]


@pytest.mark.parametrize("sensor_state", ["unavailable", "unknown", "nan", "not-a-number"])
async def test_scheduled_run_skipped_when_r2_sensor_unusable(
    hass: HomeAssistant, setup_zone, mock_homeassistant_services, sensor_state
) -> None:
    """R2 is fail-safe exactly like R1: an unusable reading blocks the run."""
    hass.states.async_set("switch.zone1", STATE_OFF)
    hass.states.async_set("sensor.reservoir1_ph", "6.0")
    hass.states.async_set("sensor.reservoir2_ph", sensor_state)
    entry = await _setup_zone(
        hass,
        setup_zone,
        **{
            CONF_PH_ENTITY_ID: "sensor.reservoir1_ph",
            CONF_PH_MIN: 5.5,
            CONF_PH_MAX: 6.5,
            CONF_PH_ENTITY_ID_2: "sensor.reservoir2_ph",
            CONF_PH_MIN_2: 5.8,
            CONF_PH_MAX_2: 6.8,
        },
    )
    scheduler = scheduler_of(entry)
    assert scheduler.next_run is not None

    async_fire_time_changed_exact(hass, scheduler.next_run)
    await hass.async_block_till_done()

    assert not scheduler.is_watering
    assert "daily-06" in scheduler.schedule_warnings


async def test_r2_gate_disabled_when_entity_id_not_configured(
    hass: HomeAssistant, setup_zone, mock_homeassistant_services
) -> None:
    """Only R1 configured: R2 must never block (it is simply not in use)."""
    hass.states.async_set("switch.zone1", STATE_OFF)
    hass.states.async_set("sensor.reservoir1_ph", "6.0")
    entry = await _setup_zone(
        hass,
        setup_zone,
        **{
            CONF_PH_ENTITY_ID: "sensor.reservoir1_ph",
            CONF_PH_MIN: 5.5,
            CONF_PH_MAX: 6.5,
        },
    )
    scheduler = scheduler_of(entry)
    assert scheduler.ph_entity_id_2 == ""
    assert scheduler.next_run is not None

    async_fire_time_changed_exact(hass, scheduler.next_run)
    await hass.async_block_till_done()

    assert scheduler.is_watering
    assert scheduler.schedule_warnings == {}


async def test_water_now_ignores_r2_gate(
    hass: HomeAssistant, setup_zone, mock_homeassistant_services
) -> None:
    hass.states.async_set("switch.zone1", STATE_OFF)
    hass.states.async_set("sensor.reservoir2_ph", "9.0")  # way out of range
    entry = await _setup_zone(
        hass,
        setup_zone,
        **{
            CONF_PH_ENTITY_ID_2: "sensor.reservoir2_ph",
            CONF_PH_MIN_2: 5.8,
            CONF_PH_MAX_2: 6.8,
        },
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
