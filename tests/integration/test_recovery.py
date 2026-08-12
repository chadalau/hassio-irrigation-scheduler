"""Integration tests for restart recovery and run lifecycle edge cases."""

from __future__ import annotations

import asyncio
import logging
from datetime import timedelta
from unittest.mock import patch

from homeassistant.const import STATE_OFF, STATE_ON
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.dispatcher import async_dispatcher_connect
from homeassistant.util import dt as dt_util

from pytest_homeassistant_custom_component.common import (
    MockConfigEntry,
    async_fire_time_changed_exact,
    async_mock_service,
)

from custom_components.irrigation_scheduler.const import (
    ACTUATION_GRACE,
    CONF_DEFAULT_DURATION,
    CONF_ENABLED,
    CONF_MAX_DURATION,
    CONF_NAME,
    CONF_SCHEDULES,
    CONF_TARGET_ENTITY_ID,
    DOMAIN,
    SERVICE_WATER_NOW,
    SIGNAL_UPDATE,
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


def _populate_store(hass_storage, entry_id: str, run_state: dict) -> None:
    hass_storage[RUNTIME_KEY] = {
        "version": 1,
        "minor_version": 1,
        "key": RUNTIME_KEY,
        "data": {"entries": {entry_id: run_state}},
    }


async def test_stale_past_run_is_turned_off_defensively_on_setup(
    hass: HomeAssistant, hass_storage, mock_homeassistant_services
) -> None:
    """15. Store with finishes_at in the past: the target is defensively turned
    off during setup and the entry is removed from the store."""
    turn_on_calls, turn_off_calls = mock_homeassistant_services
    entry_id = "recovery_past"
    hass.states.async_set("switch.zone1", STATE_ON)

    _populate_store(
        hass_storage,
        entry_id,
        {
            "started_at": (dt_util.utcnow() - timedelta(hours=2)).isoformat(),
            "finishes_at": (dt_util.utcnow() - timedelta(hours=1)).isoformat(),
            "duration": 600,
            "source": "schedule",
            "schedule_id": "s1",
        },
    )

    entry = _base_entry(entry_id)
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()

    # Defensive turn-off issued, no turn-on.
    assert len(turn_off_calls) == 1
    assert turn_off_calls[0].data["entity_id"] == "switch.zone1"
    assert turn_on_calls == []

    scheduler = scheduler_of(entry)
    assert not scheduler.is_watering
    assert hass.states.get("switch.zone1").state == STATE_OFF
    assert hass.states.get("binary_sensor.garden_watering").state == STATE_OFF

    # The stale entry was removed from the store.
    store = hass.data[DOMAIN]["store"]
    assert (await store.async_load())["entries"] == {}


async def test_future_run_is_resumed_and_turns_off_at_finishes_at(
    hass: HomeAssistant, hass_storage, mock_homeassistant_services
) -> None:
    """16. Store with finishes_at in the future: the run resumes, the binary
    sensor is born on, and the target turns off when finishes_at arrives."""
    turn_on_calls, turn_off_calls = mock_homeassistant_services
    entry_id = "recovery_future"
    finishes_at = dt_util.utcnow() + timedelta(minutes=30)
    hass.states.async_set("switch.zone1", STATE_ON)

    _populate_store(
        hass_storage,
        entry_id,
        {
            "started_at": (finishes_at - timedelta(minutes=30)).isoformat(),
            "finishes_at": finishes_at.isoformat(),
            "duration": 1800,
            "source": "manual",
            "schedule_id": None,
        },
    )

    entry = _base_entry(entry_id)
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()

    scheduler = scheduler_of(entry)
    assert scheduler.is_watering
    assert scheduler.finishes_at is not None
    assert scheduler.finishes_at.replace(microsecond=0) == finishes_at.replace(
        microsecond=0
    )
    assert turn_on_calls == []  # resumed, not re-started
    binary_state = hass.states.get("binary_sensor.garden_watering")
    assert binary_state is not None and binary_state.state == STATE_ON

    # The stop timer was re-armed: firing at/after finishes_at ends the run.
    async_fire_time_changed_exact(hass, finishes_at + timedelta(seconds=1))
    await hass.async_block_till_done()

    assert not scheduler.is_watering
    assert len(turn_off_calls) == 1
    assert hass.states.get("switch.zone1").state == STATE_OFF
    assert hass.states.get("binary_sensor.garden_watering").state == STATE_OFF
    store = hass.data[DOMAIN]["store"]
    assert (await store.async_load())["entries"] == {}


async def test_external_target_off_finishes_run_without_duplicate_dispatch(
    hass: HomeAssistant, setup_zone, mock_homeassistant_services
) -> None:
    """17. Externally turning the target off during a run finishes it, cleans
    the store, raises no exception and dispatches exactly once (regression of
    item 5)."""
    hass.states.async_set("switch.zone1", STATE_OFF)
    entry = await setup_zone(target_entity_id="switch.zone1", name="Garden")
    sensor_eid = entity_id_of(hass, entry, "sensor", "next_run")
    assert sensor_eid

    dispatches: list[int] = []
    unsub = async_dispatcher_connect(
        hass,
        SIGNAL_UPDATE.format(entry_id=entry.entry_id),
        lambda: dispatches.append(1),
    )

    await hass.services.async_call(
        DOMAIN, SERVICE_WATER_NOW, {"entity_id": sensor_eid}, blocking=True
    )
    await hass.async_block_till_done()
    scheduler = scheduler_of(entry)
    assert scheduler.is_watering
    assert hass.states.get("switch.zone1").state == STATE_ON

    before = len(dispatches)
    # The listener now IGNORES "off" events inside the run's actuation grace
    # window (the deferred actuation check decides the run's health), so the
    # external stop is simulated AFTER the grace window has elapsed.
    assert scheduler.started_at is not None
    after_grace = scheduler.started_at + timedelta(seconds=ACTUATION_GRACE + 1)
    with patch("homeassistant.util.dt.utcnow", return_value=after_grace):
        # External actor turns the target off.
        hass.states.async_set("switch.zone1", STATE_OFF)
        await hass.async_block_till_done()

    assert not scheduler.is_watering
    assert len(dispatches) - before == 1  # exactly one finish dispatch
    store = hass.data[DOMAIN]["store"]
    assert (await store.async_load())["entries"] == {}
    unsub()


async def test_scheduled_fire_while_watering_is_ignored_and_does_not_stack(
    hass: HomeAssistant, setup_zone, mock_homeassistant_services
) -> None:
    """18. A scheduled firing while already watering is ignored: no stacking."""
    hass.states.async_set("switch.zone1", STATE_OFF)
    # One schedule every hour of the day -> the next firing is at most 1 h away,
    # always BEFORE the end of the 12 h manual run below (so firing the schedule
    # timer cannot also fire the stop timer).
    schedules = [
        {
            "id": f"hourly-{hour:02d}",
            "time": f"{hour:02d}:00:00",
            "days": [0, 1, 2, 3, 4, 5, 6],
            "duration": 900,
            "enabled": True,
        }
        for hour in range(24)
    ]
    entry = await setup_zone(
        target_entity_id="switch.zone1",
        name="Garden",
        options={
            CONF_ENABLED: True,
            CONF_DEFAULT_DURATION: 600,
            CONF_MAX_DURATION: 86400,
            CONF_SCHEDULES: schedules,
        },
    )
    sensor_eid = entity_id_of(hass, entry, "sensor", "next_run")
    assert sensor_eid

    scheduler = scheduler_of(entry)
    assert scheduler.next_run is not None
    next_fire = scheduler.next_run

    # Start a manual watering that is still active when the schedule fires.
    await hass.services.async_call(
        DOMAIN,
        SERVICE_WATER_NOW,
        {"entity_id": sensor_eid, "duration": 43200},
        blocking=True,
    )
    await hass.async_block_till_done()
    assert scheduler.is_watering
    assert scheduler.finishes_at is not None
    assert next_fire < scheduler.finishes_at
    finishes_before = scheduler.finishes_at

    async_fire_time_changed_exact(hass, next_fire)
    await hass.async_block_till_done()

    # The run was NOT restarted/stacked: same run, same finish time.
    assert scheduler.is_watering
    assert scheduler.finishes_at == finishes_before
    assert scheduler.active_duration == 43200
    assert hass.states.get("switch.zone1").state == STATE_ON

    store = hass.data[DOMAIN]["store"]
    data = await store.async_load()
    assert data["entries"][entry.entry_id]["duration"] == 43200


async def test_target_that_does_not_actuate_aborts_run_with_error_log(
    hass: HomeAssistant, setup_zone
) -> None:
    """19. A target whose turn_on does not change state: once the actuation
    grace elapses the run is ended, the target is turned off defensively, the
    binary sensor is off and an ERROR is logged (BLOCKER 1 abort, deferred).

    Behavior changed with the async-device fix: the run is no longer aborted
    IMMEDIATELY after turn_on (an async device is always still "off" at that
    instant). It is given ACTUATION_GRACE; only if it still has not actuated
    by then is the run ended loudly.

    Logs are captured with a dedicated handler: PHCC's ``caplog`` override
    recurses under pytest 9, so the built-in fixture cannot be used here.
    """
    # The service exists but does NOT change the target state (no actuation).
    noop_turn_on = async_mock_service(hass, "homeassistant", "turn_on")
    turn_off_calls = async_mock_service(hass, "homeassistant", "turn_off")
    hass.states.async_set("switch.zone1", STATE_OFF)
    entry = await setup_zone(target_entity_id="switch.zone1", name="Garden")
    sensor_eid = entity_id_of(hass, entry, "sensor", "next_run")
    binary_eid = entity_id_of(hass, entry, "binary_sensor", "watering")
    assert sensor_eid and binary_eid

    captured: list[logging.LogRecord] = []
    handler = logging.Handler()
    handler.emit = captured.append  # type: ignore[method-assign]
    logger = logging.getLogger("custom_components.irrigation_scheduler")
    logger.addHandler(handler)
    try:
        await hass.services.async_call(
            DOMAIN, SERVICE_WATER_NOW, {"entity_id": sensor_eid}, blocking=True
        )
        await hass.async_block_till_done()

        assert len(noop_turn_on) == 1  # the command WAS sent
        scheduler = scheduler_of(entry)
        # The run is briefly active while the target is given its actuation
        # grace (async devices report their state seconds later).
        assert scheduler.is_watering
        assert scheduler.finishes_at is not None

        # Grace elapses: the target still has not actuated.
        assert scheduler.started_at is not None
        async_fire_time_changed_exact(
            hass, scheduler.started_at + timedelta(seconds=ACTUATION_GRACE + 1)
        )
        await hass.async_block_till_done()
    finally:
        logger.removeHandler(handler)

    assert not scheduler.is_watering  # run ended after the grace
    assert len(turn_off_calls) == 1  # defensive turn-off was sent
    assert hass.states.get(binary_eid).state == STATE_OFF
    assert hass.states.get("switch.zone1").state == STATE_OFF

    store = hass.data[DOMAIN]["store"]
    assert (await store.async_load())["entries"] == {}

    assert any(
        record.levelno == logging.ERROR and "aborting" in record.getMessage()
        for record in captured
    )


async def test_failed_turn_off_keeps_store_for_restart_recovery(
    hass: HomeAssistant, setup_zone
) -> None:
    """REGRESSION: when turn_off fails the runtime store entry is KEPT (it is
    the restart-recovery safety net) and a restart defensively turns the
    target off and cleans the store.

    Before this fix, _async_finish_run logged the failed turn_off and removed
    the store entry anyway, leaving a possibly-open valve with no recovery
    record after a restart.
    """
    # turn_on works (target goes ON), turn_off ALWAYS fails (device down).
    failed_off_calls: list = []

    @callback
    def _turn_on(call):
        hass.states.async_set("switch.zone1", STATE_ON)

    def _raising_turn_off(call):
        failed_off_calls.append(call)
        raise RuntimeError("device unreachable")

    hass.services.async_register("homeassistant", "turn_on", _turn_on)
    hass.services.async_register("homeassistant", "turn_off", _raising_turn_off)

    hass.states.async_set("switch.zone1", STATE_OFF)
    entry = await setup_zone(target_entity_id="switch.zone1", name="Garden")
    sensor_eid = entity_id_of(hass, entry, "sensor", "next_run")
    assert sensor_eid
    scheduler = scheduler_of(entry)

    captured: list[logging.LogRecord] = []
    handler = logging.Handler()
    handler.emit = captured.append  # type: ignore[method-assign]
    logger = logging.getLogger("custom_components.irrigation_scheduler")
    logger.addHandler(handler)
    try:
        # -- start a run and stop it; every turn_off attempt raises --
        await hass.services.async_call(
            DOMAIN, SERVICE_WATER_NOW, {"entity_id": sensor_eid}, blocking=True
        )
        await hass.async_block_till_done()
        assert scheduler.is_watering
        assert hass.states.get("switch.zone1").state == STATE_ON

        stop_task = hass.async_create_task(scheduler.async_stop())
        await asyncio.sleep(0)  # attempt 1 raises and parks on the backoff
        # Fire the backoff twice: attempts 2 and 3 also raise.
        async_fire_time_changed_exact(
            hass,
            dt_util.utcnow() + timedelta(seconds=TURN_OFF_RETRY_DELAY + 2),
        )
        await asyncio.sleep(0)
        async_fire_time_changed_exact(
            hass,
            dt_util.utcnow() + timedelta(seconds=TURN_OFF_RETRY_DELAY + 2),
        )
        await hass.async_block_till_done()
        assert stop_task.done()
    finally:
        logger.removeHandler(handler)

    # The retry loop stopped after EXACTLY TURN_OFF_MAX_ATTEMPTS service calls
    # (one per attempt, no stray/dispatch duplicate beyond the hard limit).
    assert len(failed_off_calls) == TURN_OFF_MAX_ATTEMPTS

    # In-memory run ended, but the store entry SURVIVES (recovery safety net).
    assert not scheduler.is_watering
    store = hass.data[DOMAIN]["store"]
    data = await store.async_load()
    assert entry.entry_id in data["entries"]
    assert any(
        record.levelno == logging.ERROR and "keeping runtime state" in record.getMessage()
        for record in captured
    )

    # -- "restart": the run's deadline passes while the device is down, then
    # the same entry is set up again with a working turn_off --
    run_state = data["entries"][entry.entry_id]
    run_state["started_at"] = (dt_util.utcnow() - timedelta(minutes=35)).isoformat()
    run_state["finishes_at"] = (dt_util.utcnow() - timedelta(minutes=5)).isoformat()
    await store.async_save_entry(entry.entry_id, run_state)

    assert await hass.config_entries.async_unload(entry.entry_id)
    await hass.async_block_till_done()

    hass.services.async_remove("homeassistant", "turn_off")
    off_calls = []

    @callback
    def _working_turn_off(call):
        off_calls.append(call)
        hass.states.async_set("switch.zone1", STATE_OFF)

    hass.services.async_register("homeassistant", "turn_off", _working_turn_off)

    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()

    # Recovery issued a DEFENSIVE turn_off and cleaned the store.
    assert len(off_calls) == 1
    assert off_calls[0].data["entity_id"] == "switch.zone1"
    assert not scheduler_of(entry).is_watering
    assert hass.states.get("switch.zone1").state == STATE_OFF
    data = await store.async_load()
    assert data["entries"] == {}


async def test_recovery_keeps_store_when_defensive_turn_off_fails(
    hass: HomeAssistant, hass_storage
) -> None:
    """REGRESSION: when the DEFENSIVE turn_off during recovery fails (device
    unavailable at boot) the runtime store entry is KEPT so the NEXT boot
    retries; only a target CONFIRMED off drops the recovery record.

    Before this fix the store entry was removed unconditionally after the
    defensive turn_off, so a failed turn_off left the target possibly open
    with no recovery record for any later restart.
    """

    def _raising_turn_off(call):
        raise RuntimeError("device unreachable")

    hass.services.async_register("homeassistant", "turn_off", _raising_turn_off)
    hass.states.async_set("switch.zone1", STATE_ON)

    entry_id = "recovery_keep"
    _populate_store(
        hass_storage,
        entry_id,
        {
            "started_at": (dt_util.utcnow() - timedelta(hours=2)).isoformat(),
            "finishes_at": (dt_util.utcnow() - timedelta(hours=1)).isoformat(),
            "duration": 600,
            "source": "schedule",
            "schedule_id": "s1",
        },
    )

    entry = _base_entry(entry_id)
    entry.add_to_hass(hass)

    captured: list[logging.LogRecord] = []
    handler = logging.Handler()
    handler.emit = captured.append  # type: ignore[method-assign]
    logger = logging.getLogger("custom_components.irrigation_scheduler")
    logger.addHandler(handler)
    try:
        assert await hass.config_entries.async_setup(entry.entry_id)
        await hass.async_block_till_done()
    finally:
        logger.removeHandler(handler)

    # The target is still on and the store entry SURVIVED the failed turn_off.
    assert hass.states.get("switch.zone1").state == STATE_ON
    store = hass.data[DOMAIN]["store"]
    data = await store.async_load()
    assert entry_id in data["entries"]
    assert any(
        record.levelno == logging.ERROR and "keeping runtime state" in record.getMessage()
        for record in captured
    )

    # -- "restart": the device comes back and the same entry boots again --
    hass.services.async_remove("homeassistant", "turn_off")
    off_calls = []

    @callback
    def _working_turn_off(call):
        off_calls.append(call)
        hass.states.async_set("switch.zone1", STATE_OFF)

    hass.services.async_register("homeassistant", "turn_off", _working_turn_off)

    assert await hass.config_entries.async_unload(entry.entry_id)
    await hass.async_block_till_done()
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()

    # The second boot retried the defensive turn_off and, with the target now
    # CONFIRMED off, finally cleaned the store.
    assert len(off_calls) == 1
    assert off_calls[0].data["entity_id"] == "switch.zone1"
    assert hass.states.get("switch.zone1").state == STATE_OFF
    data = await store.async_load()
    assert data["entries"] == {}
