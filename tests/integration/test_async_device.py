"""Regression tests: ASYNC target devices (Z-Wave, Zigbee, MQTT, valves).

These tests pin the fix for the two CRITICAL bugs that assume a SYNCHRONOUS
target (one where the entity state already reflects the command as soon as the
service returns):

1. CRITICAL 1 - ``_async_target_state_changed`` decided by the event payload
   (a snapshot) instead of the CURRENT entity state. With an async device the
   stale ``off`` echo of a finished run can arrive during a NEW run whose
   target is ON; the listener then killed the new run and left the valve open.
2. CRITICAL 2 - ``_async_start_run`` verified actuation IMMEDIATELY after the
   ``turn_on`` call, but an async device is ALWAYS still ``off`` at that
   instant, so every run was aborted right away.

The fixture ``async_device`` (see conftest) reproduces the async behaviour: the
services record the call and return WITHOUT touching the state machine; the
test controls when the state changes.
"""

from __future__ import annotations

import asyncio
import logging
from datetime import timedelta

from homeassistant.const import STATE_OFF, STATE_ON
from homeassistant.core import HomeAssistant
from homeassistant.util import dt as dt_util

from pytest_homeassistant_custom_component.common import async_fire_time_changed_exact

from custom_components.irrigation_scheduler.const import (
    ACTUATION_GRACE,
    DOMAIN,
    SERVICE_STOP,
    SERVICE_WATER_NOW,
)
from custom_components.irrigation_scheduler.scheduler import TURN_OFF_RETRY_DELAY

from .conftest import entity_id_of, scheduler_of


def _capture_logger(
    name: str = "custom_components.irrigation_scheduler",
) -> tuple[list[logging.LogRecord], logging.Handler, logging.Logger]:
    """Attach a capturing handler to the integration logger (PHCC-safe)."""
    captured: list[logging.LogRecord] = []
    handler = logging.Handler()
    handler.emit = captured.append  # type: ignore[method-assign]
    logger = logging.getLogger(name)
    logger.addHandler(handler)
    return captured, handler, logger


async def test_stale_off_echo_does_not_kill_new_run(
    hass: HomeAssistant, setup_zone, async_device
) -> None:
    """1. CRITICAL 1: a stale 'off' echo must not kill a newer run.

    run A is stopped (the async device does not change state yet), run B starts
    and its target goes ON. Only THEN the delayed 'off' echo of run A's
    turn_off arrives. The listener must decide by the CURRENT entity state
    (ON), not by the event's snapshot (OFF), so run B survives and the target
    stays on.
    """
    async_device.set_state("switch.zone1", STATE_OFF)
    entry = await setup_zone(target_entity_id="switch.zone1", name="Garden")
    sensor_eid = entity_id_of(hass, entry, "sensor", "next_run")
    assert sensor_eid

    scheduler = scheduler_of(entry)

    # -- run A: command dispatched, then the device reports ON --
    await hass.services.async_call(
        DOMAIN, SERVICE_WATER_NOW, {"entity_id": sensor_eid}, blocking=True
    )
    await hass.async_block_till_done()
    assert scheduler.is_watering
    async_device.set_state("switch.zone1", STATE_ON)
    await hass.async_block_till_done()

    # -- stop run A: turn_off dispatched, state NOT changed yet. The stop is
    # non-blocking because the async device cannot confirm the turn_off, so the
    # finish retry loop parks on its backoff timer --
    await hass.services.async_call(
        DOMAIN, SERVICE_STOP, {"entity_id": sensor_eid}, blocking=False
    )
    await asyncio.sleep(0)
    assert not scheduler.is_watering
    assert len(async_device.turn_off_calls) == 1
    assert hass.states.get("switch.zone1").state == STATE_ON

    # -- run B starts; its target is (and stays) ON --
    await hass.services.async_call(
        DOMAIN, SERVICE_WATER_NOW, {"entity_id": sensor_eid}, blocking=True
    )
    await hass.async_block_till_done()
    assert scheduler.is_watering
    assert len(async_device.turn_on_calls) == 2
    run_b_finishes = scheduler.finishes_at
    assert run_b_finishes is not None

    # Run A's turn_off retry now bails out: a newer run generation is active,
    # so it must NOT issue any further turn_off for run B's target.
    async_fire_time_changed_exact(
        hass,
        dt_util.utcnow() + timedelta(seconds=TURN_OFF_RETRY_DELAY + 2),
    )
    await hass.async_block_till_done()
    assert len(async_device.turn_off_calls) == 1

    # -- deliver the stale 'off' echo of run A's turn_off --
    async_device.deliver_stale_off("switch.zone1")
    await hass.async_block_till_done()

    # run B is STILL alive, its timer is armed and the target is STILL ON.
    assert scheduler.is_watering
    assert scheduler.finishes_at == run_b_finishes
    assert hass.states.get("switch.zone1").state == STATE_ON

    # And run B still turns off when its own time arrives.
    async_fire_time_changed_exact(
        hass, scheduler.finishes_at + timedelta(seconds=1)
    )
    assert not scheduler.is_watering
    assert len(async_device.turn_off_calls) == 2
    # The async device finally reports off; confirming the turn_off lets the
    # finish clean up the runtime store.
    async_device.set_state("switch.zone1", STATE_OFF)
    async_fire_time_changed_exact(
        hass,
        dt_util.utcnow() + timedelta(seconds=TURN_OFF_RETRY_DELAY + 2),
    )
    await hass.async_block_till_done()
    assert len(async_device.turn_off_calls) == 3
    store = hass.data[DOMAIN]["store"]
    assert (await store.async_load())["entries"] == {}


async def test_slow_device_actuating_within_grace_survives_and_turns_off(
    hass: HomeAssistant, setup_zone, async_device
) -> None:
    """2. CRITICAL 2: a slow-but-working device is NOT aborted.

    The async device actuates some time AFTER the turn_on command returns but
    within the grace window: the run survives the deferred check and the target
    is turned off at finishes_at.
    """
    async_device.set_state("switch.zone1", STATE_OFF)
    entry = await setup_zone(target_entity_id="switch.zone1", name="Garden")
    sensor_eid = entity_id_of(hass, entry, "sensor", "next_run")
    assert sensor_eid

    scheduler = scheduler_of(entry)
    await hass.services.async_call(
        DOMAIN, SERVICE_WATER_NOW, {"entity_id": sensor_eid}, blocking=True
    )
    await hass.async_block_till_done()

    # The run survives the async actuation lag (the check is deferred, and the
    # stop timer is already armed).
    assert scheduler.is_watering
    assert len(async_device.turn_on_calls) == 1
    assert hass.states.get("switch.zone1").state == STATE_OFF  # not yet actuated
    assert scheduler.finishes_at is not None

    # The slow device reports its state within the grace window.
    async_device.set_state("switch.zone1", STATE_ON)
    await hass.async_block_till_done()

    # Grace elapses: the deferred check sees an actuated target, does nothing.
    assert scheduler.started_at is not None
    async_fire_time_changed_exact(
        hass, scheduler.started_at + timedelta(seconds=ACTUATION_GRACE + 1)
    )
    await hass.async_block_till_done()
    assert scheduler.is_watering
    assert len(async_device.turn_off_calls) == 0

    # finishes_at arrives: the run ends and the target is turned off.
    async_fire_time_changed_exact(
        hass, scheduler.finishes_at + timedelta(seconds=1)
    )
    assert not scheduler.is_watering
    assert len(async_device.turn_off_calls) == 1
    # The async device reports off after its own echo delay; confirming the
    # turn_off lets the finish clean up the runtime store.
    async_device.set_state("switch.zone1", STATE_OFF)
    async_fire_time_changed_exact(
        hass,
        dt_util.utcnow() + timedelta(seconds=TURN_OFF_RETRY_DELAY + 2),
    )
    await hass.async_block_till_done()
    assert len(async_device.turn_off_calls) == 2
    store = hass.data[DOMAIN]["store"]
    assert (await store.async_load())["entries"] == {}


async def test_never_actuating_target_ends_run_after_grace(
    hass: HomeAssistant, setup_zone, async_device
) -> None:
    """3. A device that NEVER actuates: after the grace the run ends loudly,
    a defensive turn_off is sent and no timer is left behind."""
    async_device.set_state("switch.zone1", STATE_OFF)
    entry = await setup_zone(target_entity_id="switch.zone1", name="Garden")
    sensor_eid = entity_id_of(hass, entry, "sensor", "next_run")
    binary_eid = entity_id_of(hass, entry, "binary_sensor", "watering")
    assert sensor_eid and binary_eid

    captured, handler, logger = _capture_logger()
    try:
        await hass.services.async_call(
            DOMAIN, SERVICE_WATER_NOW, {"entity_id": sensor_eid}, blocking=True
        )
        await hass.async_block_till_done()

        scheduler = scheduler_of(entry)
        # The run is briefly active while waiting for the grace (safety net
        # armed) and the error is only emitted when the grace elapses.
        assert scheduler.is_watering
        old_finishes_at = scheduler.finishes_at
        assert old_finishes_at is not None
        assert len(async_device.turn_off_calls) == 0

        # Grace elapses and the target STILL has not actuated.
        assert scheduler.started_at is not None
        async_fire_time_changed_exact(
            hass, scheduler.started_at + timedelta(seconds=ACTUATION_GRACE + 1)
        )
        await hass.async_block_till_done()
    finally:
        logger.removeHandler(handler)

    # Run ended, defensive turn_off sent, entities/store cleaned up.
    assert not scheduler.is_watering
    assert len(async_device.turn_off_calls) == 1
    assert hass.states.get(binary_eid).state == STATE_OFF
    store = hass.data[DOMAIN]["store"]
    assert (await store.async_load())["entries"] == {}

    # No timer left behind: firing at the old finishes_at must do nothing.
    assert scheduler.finishes_at is None
    assert scheduler._unsub_stop is None  # noqa: SLF001
    assert scheduler._unsub_actuation is None  # noqa: SLF001
    async_fire_time_changed_exact(hass, old_finishes_at + timedelta(seconds=1))
    await hass.async_block_till_done()
    assert len(async_device.turn_off_calls) == 1  # no extra turn_off

    # The failure is LOUD: an ERROR about the target not actuating.
    assert any(
        record.levelno == logging.ERROR and "aborting" in record.getMessage()
        for record in captured
    )


async def test_stop_timer_armed_before_deferred_actuation_check(
    hass: HomeAssistant, setup_zone, async_device
) -> None:
    """4. Between turn_on and the deferred check the stop timer is armed.

    There is never a window in which a turn_on command has been sent without a
    timer that will turn the target off.
    """
    async_device.set_state("switch.zone1", STATE_OFF)
    entry = await setup_zone(target_entity_id="switch.zone1", name="Garden")
    sensor_eid = entity_id_of(hass, entry, "sensor", "next_run")
    assert sensor_eid

    scheduler = scheduler_of(entry)
    await hass.services.async_call(
        DOMAIN, SERVICE_WATER_NOW, {"entity_id": sensor_eid}, blocking=True
    )
    await hass.async_block_till_done()

    assert scheduler.is_watering
    assert len(async_device.turn_on_calls) == 1
    # Safety net: the stop timer is armed immediately, BEFORE the deferred
    # actuation check fires.
    assert scheduler._unsub_stop is not None  # noqa: SLF001
    assert scheduler._unsub_actuation is not None  # noqa: SLF001
    assert scheduler.finishes_at is not None

    # Even though the target has not actuated yet, the stop timer ends the run
    # and turns the target off (the safety net works on its own).
    async_fire_time_changed_exact(
        hass, scheduler.finishes_at + timedelta(seconds=1)
    )
    await hass.async_block_till_done()
    assert not scheduler.is_watering
    assert len(async_device.turn_off_calls) == 1
    store = hass.data[DOMAIN]["store"]
    assert (await store.async_load())["entries"] == {}


async def test_stale_off_echo_ignored_during_actuation_window(
    hass: HomeAssistant, setup_zone, async_device
) -> None:
    """REGRESSION (residual critical): a stale 'off' echo inside a new run's
    actuation window must NOT kill the new run whose target has not actuated
    yet.

    run A is stopped (its turn_off echo is delayed), run B starts and its
    turn_on is dispatched while the target is STILL off. When run A's delayed
    'off' echo finally arrives, it falls INSIDE run B's actuation grace
    window: the listener must ignore it (the deferred actuation check decides
    the run's health). Before this fix the listener finished run B, cancelled
    its stop timer + actuation check and removed the store, leaving a valve
    that could open later with no safety net.
    """
    async_device.set_state("switch.zone1", STATE_OFF)
    entry = await setup_zone(target_entity_id="switch.zone1", name="Garden")
    sensor_eid = entity_id_of(hass, entry, "sensor", "next_run")
    assert sensor_eid

    scheduler = scheduler_of(entry)

    # -- run A: turn_on dispatched, then the device reports ON --
    await hass.services.async_call(
        DOMAIN, SERVICE_WATER_NOW, {"entity_id": sensor_eid}, blocking=True
    )
    await hass.async_block_till_done()
    assert scheduler.is_watering
    async_device.set_state("switch.zone1", STATE_ON)
    await hass.async_block_till_done()

    # -- stop run A (non-blocking: the async device cannot confirm the turn_off,
    # so the finish retry loop parks on its backoff timer). Then the device
    # reports off -- but the echo EVENT is still delayed --
    await hass.services.async_call(
        DOMAIN, SERVICE_STOP, {"entity_id": sensor_eid}, blocking=False
    )
    await asyncio.sleep(0)
    assert not scheduler.is_watering
    assert len(async_device.turn_off_calls) == 1
    assert hass.states.get("switch.zone1").state == STATE_ON
    async_device.set_state("switch.zone1", STATE_OFF)
    await asyncio.sleep(0)

    # -- run B starts: turn_on dispatched, target AINDA OFF --
    await hass.services.async_call(
        DOMAIN, SERVICE_WATER_NOW, {"entity_id": sensor_eid}, blocking=True
    )
    await hass.async_block_till_done()
    assert scheduler.is_watering
    assert len(async_device.turn_on_calls) == 2
    assert hass.states.get("switch.zone1").state == STATE_OFF
    run_b_finishes = scheduler.finishes_at
    assert run_b_finishes is not None

    # Run A's turn_off retry bails: a newer run generation is active.
    async_fire_time_changed_exact(
        hass,
        dt_util.utcnow() + timedelta(seconds=TURN_OFF_RETRY_DELAY + 2),
    )
    await hass.async_block_till_done()
    assert len(async_device.turn_off_calls) == 1  # no extra turn_off for run A

    # -- run A's delayed 'off' echo arrives DURING run B's actuation window.
    # It must be ignored: run B survives with its stop timer and actuation
    # check still armed --
    async_device.deliver_stale_off("switch.zone1")
    await hass.async_block_till_done()
    assert scheduler.is_watering
    assert scheduler.finishes_at == run_b_finishes
    assert scheduler._unsub_stop is not None  # noqa: SLF001
    assert scheduler._unsub_actuation is not None  # noqa: SLF001

    # -- finishes_at: the run ends and the target is off --
    async_fire_time_changed_exact(hass, run_b_finishes + timedelta(seconds=1))
    await hass.async_block_till_done()
    assert not scheduler.is_watering
    assert hass.states.get("switch.zone1").state == STATE_OFF
    store = hass.data[DOMAIN]["store"]
    assert (await store.async_load())["entries"] == {}
