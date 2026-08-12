"""Regression tests for findings confirmed across the deepseek/luna/qwen
adversarial reviews (2026-08-12 round).

Each test name references the finding it pins down so the review report and
the test suite stay traceable to each other.
"""

from __future__ import annotations

import logging
from datetime import timedelta

import pytest
from homeassistant.const import STATE_OFF, STATE_ON, STATE_UNAVAILABLE
from homeassistant.core import HomeAssistant, callback
from homeassistant.exceptions import ServiceValidationError
from homeassistant.util import dt as dt_util

from pytest_homeassistant_custom_component.common import (
    MockConfigEntry,
    async_fire_time_changed_exact,
)

from custom_components.irrigation_scheduler.const import (
    ACTUATION_GRACE,
    CONF_DEFAULT_DURATION,
    CONF_EC_ENTITY_ID,
    CONF_ENABLED,
    CONF_FLOW_RATE_LPH,
    CONF_MAX_DURATION,
    CONF_NAME,
    CONF_NUMBER_OF_POTS,
    CONF_PH_ENTITY_ID,
    CONF_RESERVOIR_VOLUME_L,
    CONF_SCHEDULES,
    CONF_TARGET_ENTITY_ID,
    DOMAIN,
    SERVICE_SET_SCHEDULES,
    SERVICE_STOP,
    SERVICE_WATER_NOW,
)
from custom_components.irrigation_scheduler.scheduler import (
    TURN_OFF_MAX_ATTEMPTS,
    TURN_OFF_RETRY_DELAY,
)

from .conftest import entity_id_of, scheduler_of

RUNTIME_KEY = "irrigation_scheduler.runtime"


def _base_entry(
    entry_id: str, target: str = "switch.zone1", name: str = "Garden"
) -> MockConfigEntry:
    return MockConfigEntry(
        domain=DOMAIN,
        title=name,
        data={CONF_NAME: name, CONF_TARGET_ENTITY_ID: target},
        options={
            CONF_ENABLED: True,
            CONF_DEFAULT_DURATION: 600,
            CONF_MAX_DURATION: 7200,
            CONF_SCHEDULES: [],
        },
        entry_id=entry_id,
        unique_id=target,
    )


def _capture_logger() -> tuple[list[logging.LogRecord], logging.Handler, logging.Logger]:
    captured: list[logging.LogRecord] = []
    handler = logging.Handler()
    handler.emit = captured.append  # type: ignore[method-assign]
    logger = logging.getLogger("custom_components.irrigation_scheduler")
    logger.addHandler(handler)
    return captured, handler, logger


# ---------------------------------------------------------------------------
# A2 - late actuation after a grace-abort must not lose its safety net
# ---------------------------------------------------------------------------
async def test_grace_abort_preserves_store_when_target_never_confirms_off(
    hass: HomeAssistant, setup_zone
) -> None:
    """A device that reports UNAVAILABLE (not off/closed) through every
    defensive turn_off retry after a grace-abort must not have its recovery
    record discarded: unavailable is not proof the valve closed.

    Before the fix, _async_actuation_check_fired sent a single fire-and-forget
    turn_off and unconditionally removed the store entry, leaving nothing to
    react if the target actuated later.
    """
    hass.states.async_set("switch.zone1", STATE_UNAVAILABLE)
    off_calls = []

    @callback
    def _turn_off(call):
        off_calls.append(call)
        # The device stays unavailable: turn_off cannot be confirmed.

    hass.services.async_register("homeassistant", "turn_off", _turn_off)
    hass.services.async_register(
        "homeassistant", "turn_on", lambda call: None
    )

    entry = await setup_zone(target_entity_id="switch.zone1", name="Garden")
    sensor_eid = entity_id_of(hass, entry, "sensor", "next_run")
    assert sensor_eid
    scheduler = scheduler_of(entry)

    captured, handler, logger = _capture_logger()
    try:
        await hass.services.async_call(
            DOMAIN, SERVICE_WATER_NOW, {"entity_id": sensor_eid}, blocking=True
        )
        await hass.async_block_till_done()
        assert scheduler.is_watering
        started_at = scheduler.started_at
        assert started_at is not None

        # Grace elapses: the target never actuated, so the abort path fires.
        async_fire_time_changed_exact(
            hass, started_at + timedelta(seconds=ACTUATION_GRACE + 1)
        )
        await hass.async_block_till_done()
        # Exhaust the turn_off retry loop (device stays unavailable throughout).
        for _ in range(TURN_OFF_MAX_ATTEMPTS - 1):
            async_fire_time_changed_exact(
                hass, dt_util.utcnow() + timedelta(seconds=TURN_OFF_RETRY_DELAY + 2)
            )
            await hass.async_block_till_done()
    finally:
        logger.removeHandler(handler)

    assert len(off_calls) == TURN_OFF_MAX_ATTEMPTS
    assert not scheduler.is_watering
    # The recovery record SURVIVES: unavailable never counted as confirmed off.
    store = hass.data[DOMAIN]["store"]
    data = await store.async_load()
    assert entry.entry_id in data["entries"]
    assert any(
        record.levelno == logging.ERROR and "keeping runtime state" in record.getMessage()
        for record in captured
    )

    # A later restart, once the device is reachable and reports OFF, cleans up.
    hass.services.async_remove("homeassistant", "turn_off")

    @callback
    def _working_turn_off(call):
        hass.states.async_set("switch.zone1", STATE_OFF)

    hass.services.async_register("homeassistant", "turn_off", _working_turn_off)
    assert await hass.config_entries.async_unload(entry.entry_id)
    await hass.async_block_till_done()
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()

    data = await store.async_load()
    assert data["entries"] == {}
    assert hass.states.get("switch.zone1").state == STATE_OFF


# ---------------------------------------------------------------------------
# M1 - a run that never actuated must never be logged as completed
# ---------------------------------------------------------------------------
async def test_short_run_dead_target_race_not_logged_to_history(
    hass: HomeAssistant, setup_zone
) -> None:
    """duration < ACTUATION_GRACE races the stop timer against the deferred
    actuation check; a dead target must not produce a phantom history entry
    regardless of which timer wins."""
    hass.states.async_set("switch.zone1", STATE_OFF)
    hass.services.async_register("homeassistant", "turn_on", lambda call: None)
    hass.services.async_register("homeassistant", "turn_off", lambda call: None)

    entry = await setup_zone(target_entity_id="switch.zone1", name="Garden")
    sensor_eid = entity_id_of(hass, entry, "sensor", "next_run")
    assert sensor_eid
    scheduler = scheduler_of(entry)

    await hass.services.async_call(
        DOMAIN,
        SERVICE_WATER_NOW,
        {"entity_id": sensor_eid, "duration": 5},
        blocking=True,
    )
    await hass.async_block_till_done()
    assert scheduler.is_watering
    finishes_at = scheduler.finishes_at
    assert finishes_at is not None

    async_fire_time_changed_exact(hass, finishes_at + timedelta(seconds=1))
    await hass.async_block_till_done()

    assert not scheduler.is_watering
    assert scheduler.history == []


async def test_manual_stop_during_grace_of_dead_target_not_logged_to_history(
    hass: HomeAssistant, setup_zone
) -> None:
    """Stopping manually while a dead target is still inside the actuation
    grace window must not log a phantom 0s history entry."""
    hass.states.async_set("switch.zone1", STATE_OFF)
    hass.services.async_register("homeassistant", "turn_on", lambda call: None)
    hass.services.async_register("homeassistant", "turn_off", lambda call: None)

    entry = await setup_zone(target_entity_id="switch.zone1", name="Garden")
    sensor_eid = entity_id_of(hass, entry, "sensor", "next_run")
    assert sensor_eid
    scheduler = scheduler_of(entry)

    await hass.services.async_call(
        DOMAIN,
        SERVICE_WATER_NOW,
        {"entity_id": sensor_eid, "duration": 600},
        blocking=True,
    )
    await hass.async_block_till_done()
    assert scheduler.is_watering

    await hass.services.async_call(
        DOMAIN, SERVICE_STOP, {"entity_id": sensor_eid}, blocking=True
    )
    await hass.async_block_till_done()

    assert not scheduler.is_watering
    assert scheduler.history == []


async def test_normal_completed_run_is_still_logged_to_history(
    hass: HomeAssistant, setup_zone
) -> None:
    """Regression guard for the history_actuated gate: a target that DID turn
    on must still be logged normally (no false negative introduced)."""

    @callback
    def _turn_on(call):
        hass.states.async_set("switch.zone1", STATE_ON)

    @callback
    def _turn_off(call):
        hass.states.async_set("switch.zone1", STATE_OFF)

    hass.states.async_set("switch.zone1", STATE_OFF)
    hass.services.async_register("homeassistant", "turn_on", _turn_on)
    hass.services.async_register("homeassistant", "turn_off", _turn_off)

    entry = await setup_zone(target_entity_id="switch.zone1", name="Garden")
    sensor_eid = entity_id_of(hass, entry, "sensor", "next_run")
    assert sensor_eid
    scheduler = scheduler_of(entry)

    await hass.services.async_call(
        DOMAIN,
        SERVICE_WATER_NOW,
        {"entity_id": sensor_eid, "duration": 5},
        blocking=True,
    )
    await hass.async_block_till_done()
    finishes_at = scheduler.finishes_at
    assert finishes_at is not None

    async_fire_time_changed_exact(hass, finishes_at + timedelta(seconds=1))
    await hass.async_block_till_done()

    assert not scheduler.is_watering
    assert len(scheduler.history) == 1


# ---------------------------------------------------------------------------
# A1 - options flow must not wipe pH/EC when the keys are simply absent
# ---------------------------------------------------------------------------
async def test_options_flow_preserves_ph_ec_when_keys_omitted(
    hass: HomeAssistant, setup_zone
) -> None:
    hass.states.async_set("sensor.reservoir_ph", "6.0")
    hass.states.async_set("sensor.reservoir_ec", "1.2")
    entry = await setup_zone(target_entity_id="switch.zone1", name="Garden")

    hass.config_entries.async_update_entry(
        entry,
        options={
            **dict(entry.options),
            CONF_PH_ENTITY_ID: "sensor.reservoir_ph",
            CONF_EC_ENTITY_ID: "sensor.reservoir_ec",
        },
    )
    await hass.async_block_till_done()

    result = await hass.config_entries.options.async_init(entry.entry_id)
    await hass.config_entries.options.async_configure(
        result["flow_id"],
        user_input={
            CONF_DEFAULT_DURATION: 5,
            CONF_MAX_DURATION: 60,
            CONF_FLOW_RATE_LPH: 100,
            CONF_NUMBER_OF_POTS: 2,
            CONF_RESERVOIR_VOLUME_L: 10,
            # ph_entity_id / ec_entity_id deliberately absent.
        },
    )
    await hass.async_block_till_done()

    assert entry.options.get(CONF_PH_ENTITY_ID) == "sensor.reservoir_ph"
    assert entry.options.get(CONF_EC_ENTITY_ID) == "sensor.reservoir_ec"


# ---------------------------------------------------------------------------
# Luna Média - set_schedules must reject duplicate ids
# ---------------------------------------------------------------------------
async def test_set_schedules_rejects_duplicate_ids(
    hass: HomeAssistant, setup_zone
) -> None:
    entry = await setup_zone(target_entity_id="switch.zone1", name="Garden")
    sensor_eid = entity_id_of(hass, entry, "sensor", "next_run")
    assert sensor_eid

    with pytest.raises(ServiceValidationError):
        await hass.services.async_call(
            DOMAIN,
            SERVICE_SET_SCHEDULES,
            {
                "entity_id": sensor_eid,
                "schedules": [
                    {"id": "dup", "time": "06:00", "days": [0], "duration": 60},
                    {"id": "dup", "time": "07:00", "days": [1], "duration": 60},
                ],
            },
            blocking=True,
        )
    await hass.async_block_till_done()

    # Rejected outright: the option list was never replaced.
    assert entry.options.get(CONF_SCHEDULES) == []


# ---------------------------------------------------------------------------
# Qwen M1 - abort must clear the pH/EC snapshot like a normal finish does
# ---------------------------------------------------------------------------
async def test_abort_run_clears_ph_ec_snapshot(
    hass: HomeAssistant, setup_zone
) -> None:
    hass.states.async_set("sensor.reservoir_ph", "6.0")

    def _raising_turn_on(call):
        raise RuntimeError("device unreachable")

    hass.services.async_register("homeassistant", "turn_on", _raising_turn_on)
    hass.services.async_register("homeassistant", "turn_off", lambda call: None)
    hass.states.async_set("switch.zone1", STATE_OFF)

    entry = await setup_zone(target_entity_id="switch.zone1", name="Garden")
    hass.config_entries.async_update_entry(
        entry,
        options={**dict(entry.options), CONF_PH_ENTITY_ID: "sensor.reservoir_ph"},
    )
    await hass.async_block_till_done()
    sensor_eid = entity_id_of(hass, entry, "sensor", "next_run")
    assert sensor_eid
    scheduler = scheduler_of(entry)

    await hass.services.async_call(
        DOMAIN, SERVICE_WATER_NOW, {"entity_id": sensor_eid}, blocking=True
    )
    await hass.async_block_till_done()

    assert not scheduler.is_watering
    assert scheduler._active_ph_value is None  # noqa: SLF001
    assert scheduler._active_ec_value is None  # noqa: SLF001
    assert scheduler._active_ec_unit is None  # noqa: SLF001


# ---------------------------------------------------------------------------
# DeepSeek B2 - abort must not discard the store if turn_off isn't confirmed
# ---------------------------------------------------------------------------
async def test_abort_run_preserves_store_when_defensive_turn_off_unconfirmed(
    hass: HomeAssistant, setup_zone
) -> None:
    def _raising_turn_on(call):
        raise RuntimeError("device unreachable")

    hass.services.async_register("homeassistant", "turn_on", _raising_turn_on)
    hass.services.async_register("homeassistant", "turn_off", lambda call: None)
    # The target reports unavailable throughout: the defensive turn_off can
    # never be confirmed.
    hass.states.async_set("switch.zone1", STATE_UNAVAILABLE)

    entry = await setup_zone(target_entity_id="switch.zone1", name="Garden")
    sensor_eid = entity_id_of(hass, entry, "sensor", "next_run")
    assert sensor_eid
    scheduler = scheduler_of(entry)

    await hass.services.async_call(
        DOMAIN, SERVICE_WATER_NOW, {"entity_id": sensor_eid}, blocking=True
    )
    await hass.async_block_till_done()

    assert not scheduler.is_watering
    store = hass.data[DOMAIN]["store"]
    data = await store.async_load()
    assert entry.entry_id in data["entries"]


# ---------------------------------------------------------------------------
# DeepSeek B3 - an unsupported target domain must fail BEFORE any state
# mutation, never leaving the zone stuck "watering"
# ---------------------------------------------------------------------------
async def test_unsupported_domain_does_not_leave_zone_stuck_watering(
    hass: HomeAssistant,
) -> None:
    # Only reachable via a hand-edited/corrupted config entry: the config
    # flow itself restricts target_entity_id to the 4 supported domains.
    entry = _base_entry("bad_domain", target="fan.broken")
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()

    sensor_eid = entity_id_of(hass, entry, "sensor", "next_run")
    assert sensor_eid
    scheduler = scheduler_of(entry)

    with pytest.raises(ValueError):
        await hass.services.async_call(
            DOMAIN, SERVICE_WATER_NOW, {"entity_id": sensor_eid}, blocking=True
        )
    await hass.async_block_till_done()

    assert not scheduler.is_watering
    store = hass.data[DOMAIN]["store"]
    data = await store.async_load()
    assert data["entries"] == {}
