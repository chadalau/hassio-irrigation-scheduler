"""Regression tests for findings confirmed in the second (4-reviewer) round:
deepseek, deepseek-pro, luna, qwen3.7-max, 2026-08-12.

Each test name references the finding it pins down.
"""

from __future__ import annotations

from datetime import timedelta
from unittest.mock import patch

from homeassistant.const import STATE_OFF, STATE_ON, STATE_UNAVAILABLE
from homeassistant.core import HomeAssistant, callback
from homeassistant.util import dt as dt_util
from pytest_homeassistant_custom_component.common import async_fire_time_changed_exact

from custom_components.irrigation_scheduler.const import (
    ACTUATION_GRACE,
    CONF_PH_ENTITY_ID,
    DOMAIN,
    SERVICE_SET_ZONE_OPTIONS,
    SERVICE_WATER_NOW,
)
from custom_components.irrigation_scheduler.store import _prune_history

from .conftest import entity_id_of, scheduler_of
from .test_recovery import _base_entry, _populate_store


async def test_external_stop_after_real_watering_is_logged_to_history(
    hass: HomeAssistant, setup_zone
) -> None:
    """A run that genuinely delivered water and was then stopped by an
    EXTERNAL actor (not our own stop timer/manual stop) must still be
    logged -- the target being off by the time _async_finish_run runs is
    not proof it never watered."""

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
    scheduler = scheduler_of(entry)

    await hass.services.async_call(
        DOMAIN, SERVICE_WATER_NOW, {"entity_id": sensor_eid, "duration": 600}, blocking=True
    )
    await hass.async_block_till_done()
    assert scheduler.is_watering

    # Past the actuation grace, so the deferred check has already run and
    # confirmed actuation; then an EXTERNAL actor (not this integration)
    # flips the target off directly.
    future = scheduler.started_at + timedelta(seconds=ACTUATION_GRACE + 1)
    with patch.object(dt_util, "utcnow", return_value=future):
        async_fire_time_changed_exact(hass, future)
        await hass.async_block_till_done()
        hass.states.async_set("switch.zone1", STATE_OFF)
        await hass.async_block_till_done()

    assert not scheduler.is_watering
    assert len(scheduler.history) == 1
    assert scheduler.history[0]["source"] == "manual"


async def test_resumed_run_that_finishes_normally_logs_restored_ph_ec(
    hass: HomeAssistant, hass_storage
) -> None:
    """A run resumed after restart must log the ph_value/ec_value that were
    persisted at its ORIGINAL start, not None."""

    @callback
    def _turn_off(call):
        hass.states.async_set("switch.zone1", STATE_OFF)

    hass.services.async_register("homeassistant", "turn_off", _turn_off)
    hass.states.async_set("switch.zone1", STATE_ON)

    entry_id = "resume_ph_2"
    _populate_store(
        hass_storage,
        entry_id,
        {
            "started_at": (dt_util.utcnow() - timedelta(seconds=1)).isoformat(),
            "finishes_at": (dt_util.utcnow() + timedelta(seconds=2)).isoformat(),
            "duration": 3,
            "source": "manual",
            "schedule_id": None,
            "ph_value": 6.1,
            "ec_value": 800.0,
            "ec_unit": "uS/cm",
            "ph_value_2": 6.4,
            "ec_value_2": 1200.0,
            "ec_unit_2": "uS/cm",
        },
    )
    entry = _base_entry(entry_id)
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()

    scheduler = scheduler_of(entry)
    assert scheduler.is_watering
    assert scheduler._active_ph_value == 6.1

    async_fire_time_changed_exact(
        hass, scheduler.finishes_at + timedelta(seconds=1)
    )
    await hass.async_block_till_done()

    assert not scheduler.is_watering
    assert len(scheduler.history) == 1
    record = scheduler.history[0]
    assert record["ph_value"] == 6.1
    assert record["ec_value"] == 800.0
    assert record["ph_value_2"] == 6.4
    assert record["ec_value_2"] == 1200.0


async def test_recovery_resumed_not_actuated_preserves_store_when_target_unavailable(
    hass: HomeAssistant, hass_storage
) -> None:
    """The 'resumed but not actuated' recovery path must use the same
    retry-with-confirmation policy as the rest of the codebase: if the
    defensive turn_off cannot be confirmed (target unavailable), KEEP the
    store entry instead of discarding it unconditionally."""

    def _raising_turn_off(call):
        raise RuntimeError("device unreachable")

    hass.services.async_register("homeassistant", "turn_off", _raising_turn_off)
    hass.states.async_set("switch.zone1", STATE_UNAVAILABLE)

    entry_id = "resume_unavailable"
    _populate_store(
        hass_storage,
        entry_id,
        {
            "started_at": (dt_util.utcnow() - timedelta(minutes=1)).isoformat(),
            "finishes_at": (dt_util.utcnow() + timedelta(minutes=5)).isoformat(),
            "duration": 360,
            "source": "manual",
            "schedule_id": None,
        },
    )
    entry = _base_entry(entry_id)
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()

    store = hass.data[DOMAIN]["store"]
    data = await store.async_load()
    assert entry_id in data["entries"]

    await hass.config_entries.async_unload(entry.entry_id)


async def test_start_run_reverts_state_when_store_save_fails(
    hass: HomeAssistant, setup_zone, mock_homeassistant_services
) -> None:
    """A store I/O failure at the START of a run must not leave the zone
    stuck showing 'watering' forever with no timer and no turn_on sent."""
    hass.states.async_set("switch.zone1", STATE_OFF)
    entry = await setup_zone(target_entity_id="switch.zone1", name="Garden")
    sensor_eid = entity_id_of(hass, entry, "sensor", "next_run")
    scheduler = scheduler_of(entry)

    with patch.object(
        scheduler.store, "async_save_entry", side_effect=RuntimeError("disk full")
    ):
        await hass.services.async_call(
            DOMAIN, SERVICE_WATER_NOW, {"entity_id": sensor_eid}, blocking=True
        )
        await hass.async_block_till_done()

    assert not scheduler.is_watering
    assert scheduler.started_at is None
    assert scheduler._unsub_stop is None

    # And the zone is NOT stuck: a later water_now (store working again)
    # succeeds normally.
    await hass.services.async_call(
        DOMAIN, SERVICE_WATER_NOW, {"entity_id": sensor_eid}, blocking=True
    )
    await hass.async_block_till_done()
    assert scheduler.is_watering


def test_prune_history_normalizes_naive_started_at_instead_of_raising() -> None:
    """A corrupted/hand-edited store entry with a naive (no-tzinfo)
    started_at must not crash pruning for every zone sharing the store."""
    naive_recent = dt_util.utcnow().replace(tzinfo=None).isoformat()
    result = _prune_history(
        [{"started_at": naive_recent}], max_age_days=30, max_entries=200
    )
    assert len(result) == 1


async def test_set_zone_options_clears_stale_warnings_when_ph_gate_disabled(
    hass: HomeAssistant, setup_zone
) -> None:
    entry = await setup_zone(target_entity_id="switch.zone1", name="Garden")
    sensor_eid = entity_id_of(hass, entry, "sensor", "next_run")
    scheduler = scheduler_of(entry)
    scheduler._schedule_warnings["some-id"] = "pH fora do intervalo"

    await hass.services.async_call(
        DOMAIN,
        SERVICE_SET_ZONE_OPTIONS,
        {"entity_id": sensor_eid, CONF_PH_ENTITY_ID: ""},
        blocking=True,
    )
    await hass.async_block_till_done()

    assert scheduler.schedule_warnings == {}


# ---------------------------------------------------------------------------
# Re-verification round (deepseek, luna, qwen3.7-max) findings on the fixes
# above.
# ---------------------------------------------------------------------------


async def test_resumed_run_with_naive_started_at_does_not_crash_setup(
    hass: HomeAssistant, hass_storage
) -> None:
    """A hand-edited/corrupted store with a NAIVE (no tzinfo) started_at must
    not crash the whole zone's setup when the run is still active (resume
    path) -- as_utc() must normalize it before any arithmetic against an
    aware datetime."""
    hass.states.async_set("switch.zone1", STATE_ON)

    entry_id = "resume_naive_started_at"
    _populate_store(
        hass_storage,
        entry_id,
        {
            "started_at": "2026-08-12T20:00:00",  # no offset -> naive
            "finishes_at": (dt_util.utcnow() + timedelta(minutes=5)).isoformat(),
            "duration": 360,
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

    await hass.config_entries.async_unload(entry.entry_id)


async def test_downtime_expired_run_with_naive_started_at_does_not_crash_setup(
    hass: HomeAssistant, hass_storage
) -> None:
    """Same as above, for the OTHER recovery branch: a run that expired
    during downtime (finishes_at in the past) with a naive started_at."""

    @callback
    def _turn_off(call):
        hass.states.async_set("switch.zone1", STATE_OFF)

    hass.services.async_register("homeassistant", "turn_off", _turn_off)
    hass.states.async_set("switch.zone1", STATE_ON)

    entry_id = "downtime_naive_started_at"
    _populate_store(
        hass_storage,
        entry_id,
        {
            "started_at": "2026-08-12T18:00:00",  # no offset -> naive
            "finishes_at": (dt_util.utcnow() - timedelta(minutes=5)).isoformat(),
            "duration": 360,
            "source": "manual",
            "schedule_id": None,
            # The target was really ON (see hass.states.async_set above):
            # evidence the run genuinely delivered water, required for the
            # downtime branch to log it (see _async_store_mark_actuated).
            "actuated": True,
        },
    )
    entry = _base_entry(entry_id)
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()

    scheduler = scheduler_of(entry)
    assert not scheduler.is_watering
    assert len(scheduler.history) == 1


async def test_target_unavailable_mid_run_does_not_end_run_or_discard_store(
    hass: HomeAssistant, setup_zone
) -> None:
    """unavailable/unknown must NOT be treated as a confirmed external stop:
    no turn_off is even attempted on that path, and the store would
    otherwise be discarded with no confirmation -- exactly the fail-safe
    confirmed_off_states policy is supposed to prevent. The run must keep
    going (untouched) until its own stop timer eventually confirms things
    properly."""

    @callback
    def _turn_on(call):
        hass.states.async_set("switch.zone1", STATE_ON)

    turn_off_calls: list = []

    @callback
    def _turn_off(call):
        turn_off_calls.append(call)
        hass.states.async_set("switch.zone1", STATE_OFF)

    hass.states.async_set("switch.zone1", STATE_OFF)
    hass.services.async_register("homeassistant", "turn_on", _turn_on)
    hass.services.async_register("homeassistant", "turn_off", _turn_off)

    entry = await setup_zone(target_entity_id="switch.zone1", name="Garden")
    sensor_eid = entity_id_of(hass, entry, "sensor", "next_run")
    scheduler = scheduler_of(entry)

    await hass.services.async_call(
        DOMAIN, SERVICE_WATER_NOW, {"entity_id": sensor_eid, "duration": 600}, blocking=True
    )
    await hass.async_block_till_done()
    assert scheduler.is_watering

    future = scheduler.started_at + timedelta(seconds=ACTUATION_GRACE + 1)
    with patch.object(dt_util, "utcnow", return_value=future):
        async_fire_time_changed_exact(hass, future)
        await hass.async_block_till_done()
        # Comms lost, NOT a legitimate external stop.
        hass.states.async_set("switch.zone1", STATE_UNAVAILABLE)
        await hass.async_block_till_done()

    # The ambiguous event must be ignored: still watering, no turn_off
    # attempted, and the recovery record untouched.
    assert scheduler.is_watering
    assert len(turn_off_calls) == 0
    store = hass.data[DOMAIN]["store"]
    data = await store.async_load()
    assert entry.entry_id in data["entries"]

    # The device comes back and the run still ends normally at its own stop
    # timer, with a real turn_off.
    hass.states.async_set("switch.zone1", STATE_ON)
    async_fire_time_changed_exact(
        hass, scheduler.finishes_at + timedelta(seconds=1)
    )
    await hass.async_block_till_done()
    assert not scheduler.is_watering
    assert len(turn_off_calls) == 1
