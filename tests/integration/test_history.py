"""Integration tests for the completed-run history log.

Each record is appended when a run FINISHES through the normal path
(``_async_finish_run``) or via the restart-recovery "expired during
downtime" branch. A run that never actuates (``_async_abort_run``) delivered
no water and is deliberately NOT logged.
"""

from __future__ import annotations

from datetime import timedelta

from homeassistant.const import STATE_OFF, STATE_ON
from homeassistant.core import HomeAssistant
from pytest_homeassistant_custom_component.common import async_fire_time_changed_exact

from custom_components.irrigation_scheduler.const import (
    CONF_DEFAULT_DURATION,
    CONF_EC_ENTITY_ID,
    CONF_EC_ENTITY_ID_2,
    CONF_ENABLED,
    CONF_FLOW_RATE_LPH,
    CONF_MAX_DURATION,
    CONF_NUMBER_OF_POTS,
    CONF_PH_ENTITY_ID,
    CONF_PH_ENTITY_ID_2,
    CONF_SCHEDULES,
    DOMAIN,
    HISTORY_MAX_ENTRIES,
    SERVICE_STOP,
    SERVICE_WATER_NOW,
)

from .conftest import entity_id_of, scheduler_of
from .test_recovery import RUNTIME_KEY, _base_entry, _populate_store


async def test_manual_stop_logs_actual_elapsed_duration_not_the_requested_one(
    hass: HomeAssistant, setup_zone, mock_homeassistant_services
) -> None:
    """Stopping early logs how long it REALLY watered, not the duration that
    was requested when water_now was called."""
    hass.states.async_set("switch.zone1", STATE_OFF)
    entry = await setup_zone(
        target_entity_id="switch.zone1",
        name="Garden",
        options={
            CONF_ENABLED: True,
            CONF_DEFAULT_DURATION: 600,
            CONF_MAX_DURATION: 7200,
            CONF_FLOW_RATE_LPH: 8,
            CONF_NUMBER_OF_POTS: 4,
            CONF_SCHEDULES: [],
        },
    )
    sensor_eid = entity_id_of(hass, entry, "sensor", "next_run")
    scheduler = scheduler_of(entry)
    assert scheduler.history == []
    assert scheduler.last_run is None

    await hass.services.async_call(
        DOMAIN, SERVICE_WATER_NOW, {"entity_id": sensor_eid, "duration": 600}, blocking=True
    )
    await hass.async_block_till_done()
    assert scheduler.is_watering

    await hass.services.async_call(
        DOMAIN, SERVICE_STOP, {"entity_id": sensor_eid}, blocking=True
    )
    await hass.async_block_till_done()

    assert not scheduler.is_watering
    assert len(scheduler.history) == 1
    record = scheduler.history[0]
    assert record["source"] == "manual"
    assert record["schedule_id"] is None
    assert record["flow_rate_lph"] == 8
    assert record["number_of_pots"] == 4
    # Stopped almost immediately after starting: nowhere near the requested
    # 600s -- this is the real elapsed time, not the request.
    assert 0 <= record["duration"] < 600
    assert scheduler.last_run == record


async def test_history_captures_ph_ec_at_run_start(
    hass: HomeAssistant, setup_zone, mock_homeassistant_services
) -> None:
    """pH/EC are snapshotted AT THE MOMENT the run starts -- a later drift in
    the sensor before the run finishes must not change what gets recorded."""
    hass.states.async_set("switch.zone1", STATE_OFF)
    hass.states.async_set("sensor.reservoir_ph", "6.1")
    hass.states.async_set(
        "sensor.reservoir_ec", "800", {"unit_of_measurement": "µS/cm"}
    )
    entry = await setup_zone(
        target_entity_id="switch.zone1",
        name="Garden",
        options={
            CONF_ENABLED: True,
            CONF_DEFAULT_DURATION: 600,
            CONF_MAX_DURATION: 7200,
            CONF_SCHEDULES: [],
            CONF_PH_ENTITY_ID: "sensor.reservoir_ph",
            CONF_EC_ENTITY_ID: "sensor.reservoir_ec",
        },
    )
    sensor_eid = entity_id_of(hass, entry, "sensor", "next_run")

    await hass.services.async_call(
        DOMAIN,
        SERVICE_WATER_NOW,
        {"entity_id": sensor_eid, "duration": 600},
        blocking=True,
    )
    await hass.async_block_till_done()

    # Drift AFTER the run started, before it finishes.
    hass.states.async_set("sensor.reservoir_ph", "9.9")
    hass.states.async_set("sensor.reservoir_ec", "50")

    await hass.services.async_call(
        DOMAIN, SERVICE_STOP, {"entity_id": sensor_eid}, blocking=True
    )
    await hass.async_block_till_done()

    record = scheduler_of(entry).history[0]
    assert record["ph_value"] == 6.1
    assert record["ec_value"] == 800.0
    assert record["ec_unit"] == "µS/cm"


async def test_history_captures_r2_ph_ec_at_run_start(
    hass: HomeAssistant, setup_zone, mock_homeassistant_services
) -> None:
    """The second (independent) reservoir's pH/EC is snapshotted the same
    way as R1, into its own ph_value_2/ec_value_2/ec_unit_2 fields."""
    hass.states.async_set("switch.zone1", STATE_OFF)
    hass.states.async_set("sensor.reservoir1_ph", "6.1")
    hass.states.async_set("sensor.reservoir2_ph", "6.4")
    hass.states.async_set(
        "sensor.reservoir2_ec", "1200", {"unit_of_measurement": "µS/cm"}
    )
    entry = await setup_zone(
        target_entity_id="switch.zone1",
        name="Garden",
        options={
            CONF_ENABLED: True,
            CONF_DEFAULT_DURATION: 600,
            CONF_MAX_DURATION: 7200,
            CONF_SCHEDULES: [],
            CONF_PH_ENTITY_ID: "sensor.reservoir1_ph",
            CONF_PH_ENTITY_ID_2: "sensor.reservoir2_ph",
            CONF_EC_ENTITY_ID_2: "sensor.reservoir2_ec",
        },
    )
    sensor_eid = entity_id_of(hass, entry, "sensor", "next_run")

    await hass.services.async_call(
        DOMAIN,
        SERVICE_WATER_NOW,
        {"entity_id": sensor_eid, "duration": 600},
        blocking=True,
    )
    await hass.async_block_till_done()

    await hass.services.async_call(
        DOMAIN, SERVICE_STOP, {"entity_id": sensor_eid}, blocking=True
    )
    await hass.async_block_till_done()

    record = scheduler_of(entry).history[0]
    assert record["ph_value"] == 6.1
    assert record["ph_value_2"] == 6.4
    assert record["ec_value_2"] == 1200.0
    assert record["ec_unit_2"] == "µS/cm"
    # R1 has no EC sensor configured in this test: stays None, not missing.
    assert record["ec_value"] is None


async def test_history_records_unknown_ph_ec_as_none_when_not_configured(
    hass: HomeAssistant, setup_zone, mock_homeassistant_services
) -> None:
    """No pH/EC entity configured: the snapshot fields are simply None, not
    a missing key or an error."""
    hass.states.async_set("switch.zone1", STATE_OFF)
    entry = await setup_zone(target_entity_id="switch.zone1", name="Garden")
    sensor_eid = entity_id_of(hass, entry, "sensor", "next_run")

    await hass.services.async_call(
        DOMAIN, SERVICE_WATER_NOW, {"entity_id": sensor_eid, "duration": 5}, blocking=True
    )
    await hass.async_block_till_done()
    await hass.services.async_call(
        DOMAIN, SERVICE_STOP, {"entity_id": sensor_eid}, blocking=True
    )
    await hass.async_block_till_done()

    record = scheduler_of(entry).history[0]
    assert record["ph_value"] is None
    assert record["ec_value"] is None
    assert record["ec_unit"] is None


async def test_scheduled_run_completion_logs_source_and_schedule_id(
    hass: HomeAssistant, setup_zone, mock_homeassistant_services
) -> None:
    """A run started BY a schedule logs source="schedule" and that schedule's id."""
    hass.states.async_set("switch.zone1", STATE_OFF)
    schedules = [
        {
            "id": "s1",
            "time": "06:00:00",
            "days": [0, 1, 2, 3, 4, 5, 6],
            "duration": 30,
            "enabled": True,
        }
    ]
    entry = await setup_zone(
        target_entity_id="switch.zone1",
        name="Garden",
        options={
            CONF_ENABLED: True,
            CONF_DEFAULT_DURATION: 600,
            CONF_MAX_DURATION: 7200,
            CONF_SCHEDULES: schedules,
        },
    )
    scheduler = scheduler_of(entry)
    next_fire = scheduler.next_run
    assert next_fire is not None

    async_fire_time_changed_exact(hass, next_fire)
    await hass.async_block_till_done()
    assert scheduler.is_watering
    finishes_at = scheduler.finishes_at
    assert finishes_at is not None

    async_fire_time_changed_exact(hass, finishes_at + timedelta(seconds=1))
    await hass.async_block_till_done()

    assert not scheduler.is_watering
    assert len(scheduler.history) == 1
    record = scheduler.history[0]
    assert record["source"] == "schedule"
    assert record["schedule_id"] == "s1"
    assert record["duration"] >= 0


async def test_run_that_never_actuates_is_not_logged_to_history(
    hass: HomeAssistant, setup_zone, mock_homeassistant_services
) -> None:
    """A run that never actually turns the target on delivered no water and
    must not appear in history."""
    hass.states.async_set("switch.zone1", STATE_OFF)
    entry = await setup_zone(target_entity_id="switch.zone1", name="Garden")
    sensor_eid = entity_id_of(hass, entry, "sensor", "next_run")
    scheduler = scheduler_of(entry)

    # mock_homeassistant_services flips the state on turn_on; force it to
    # stay off by re-setting it right after, simulating a target that never
    # actually actuates (the command is sent but nothing changes).
    turn_on_calls, _turn_off_calls = mock_homeassistant_services
    from custom_components.irrigation_scheduler.const import ACTUATION_GRACE

    await hass.services.async_call(
        DOMAIN, SERVICE_WATER_NOW, {"entity_id": sensor_eid}, blocking=True
    )
    await hass.async_block_till_done()
    assert len(turn_on_calls) == 1
    hass.states.async_set("switch.zone1", STATE_OFF)  # never actuated
    assert scheduler.started_at is not None

    async_fire_time_changed_exact(
        hass, scheduler.started_at + timedelta(seconds=ACTUATION_GRACE + 1)
    )
    await hass.async_block_till_done()

    assert not scheduler.is_watering
    assert scheduler.history == []
    assert scheduler.last_run is None


async def test_run_expired_during_downtime_is_logged_on_recovery(
    hass: HomeAssistant, hass_storage, mock_homeassistant_services
) -> None:
    """A run whose finishes_at already passed while HA was off gets
    defensively turned off on recovery AND logged as a completed run."""
    from homeassistant.util import dt as dt_util

    entry_id = "recovery_history"
    hass.states.async_set("switch.zone1", STATE_ON)

    started_at = dt_util.utcnow() - timedelta(hours=2)
    finishes_at = dt_util.utcnow() - timedelta(hours=1)
    _populate_store(
        hass_storage,
        entry_id,
        {
            "started_at": started_at.isoformat(),
            "finishes_at": finishes_at.isoformat(),
            "duration": 3600,
            "source": "schedule",
            "schedule_id": "s1",
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
    record = scheduler.history[0]
    assert record["source"] == "schedule"
    assert record["schedule_id"] == "s1"
    assert record["duration"] == 3600


async def test_history_survives_restart(
    hass: HomeAssistant, setup_zone, mock_homeassistant_services
) -> None:
    """History is persisted: a fresh scheduler for the same entry (simulating
    a restart) loads the previously logged runs."""
    hass.states.async_set("switch.zone1", STATE_OFF)
    entry = await setup_zone(target_entity_id="switch.zone1", name="Garden")
    sensor_eid = entity_id_of(hass, entry, "sensor", "next_run")

    await hass.services.async_call(
        DOMAIN, SERVICE_WATER_NOW, {"entity_id": sensor_eid, "duration": 5}, blocking=True
    )
    await hass.async_block_till_done()
    await hass.services.async_call(
        DOMAIN, SERVICE_STOP, {"entity_id": sensor_eid}, blocking=True
    )
    await hass.async_block_till_done()
    assert len(scheduler_of(entry).history) == 1

    assert await hass.config_entries.async_unload(entry.entry_id)
    await hass.async_block_till_done()
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()

    assert len(scheduler_of(entry).history) == 1


async def test_history_caps_at_max_entries(
    hass: HomeAssistant, hass_storage, mock_homeassistant_services
) -> None:
    """A pathologically busy zone's history is capped at HISTORY_MAX_ENTRIES
    regardless of retention age, so the stored/attribute payload stays bounded.

    The store's own Store instance caches its first ``async_load()``, so the
    seed data MUST be written to ``hass_storage`` before the entry is set up
    (same requirement as the existing recovery tests) -- writing it after
    would be invisible to the already-cached RuntimeStore.
    """
    from homeassistant.util import dt as dt_util

    entry_id = "history_cap"
    now = dt_util.utcnow()
    seeded = [
        {
            "started_at": (now - timedelta(minutes=i)).isoformat(),
            "finishes_at": (now - timedelta(minutes=i) + timedelta(seconds=60)).isoformat(),
            "duration": 60,
            "source": "manual",
            "schedule_id": None,
            "flow_rate_lph": 0,
            "number_of_pots": 0,
        }
        for i in range(HISTORY_MAX_ENTRIES)
    ]
    hass_storage[RUNTIME_KEY] = {
        "version": 1,
        "minor_version": 1,
        "key": RUNTIME_KEY,
        "data": {"entries": {}, "history": {entry_id: seeded}},
    }

    hass.states.async_set("switch.zone1", STATE_OFF)
    entry = _base_entry(entry_id)
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    assert len(scheduler_of(entry).history) == HISTORY_MAX_ENTRIES

    sensor_eid = entity_id_of(hass, entry, "sensor", "next_run")
    await hass.services.async_call(
        DOMAIN, SERVICE_WATER_NOW, {"entity_id": sensor_eid, "duration": 5}, blocking=True
    )
    await hass.async_block_till_done()
    await hass.services.async_call(
        DOMAIN, SERVICE_STOP, {"entity_id": sensor_eid}, blocking=True
    )
    await hass.async_block_till_done()

    scheduler = scheduler_of(entry)
    assert len(scheduler.history) == HISTORY_MAX_ENTRIES
    # The newest entry (just appended) is first; the oldest seeded one fell off.
    assert scheduler.history[0]["source"] == "manual"
    assert scheduler.history[0]["duration"] < 60
