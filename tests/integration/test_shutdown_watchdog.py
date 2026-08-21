"""In-session watchdog for a target that could not be CONFIRMED off.

REGRESSION: keeping the runtime store record so "the next boot retries" is
only the DURABLE half of that safety net. On its own it left a possibly-open
valve with NOTHING watching it for the rest of the session: no stop timer, no
retry, and a state listener that actively refused to act (the still-on target
looked like a new external activation, which ``async_create_entry`` correctly
rejects because the recovery record owns the entry -- and the reverting branch
cancelled the very timer it had just armed).

The most common trigger is benign and temporary: a device that still reports
``unavailable`` a few seconds after startup and then comes back perfectly
reachable. Nothing retried it until Home Assistant happened to restart.

These tests cover the watchdog armed by restart recovery, the early settle
driven by the state listener, and the fact that a deliberate new run settles
the pending record's accounting instead of silently overwriting it.
"""

from __future__ import annotations

from datetime import timedelta

from homeassistant.const import STATE_OFF, STATE_ON, STATE_UNAVAILABLE
from homeassistant.core import HomeAssistant, callback
from homeassistant.util import dt as dt_util
from pytest_homeassistant_custom_component.common import (
    MockConfigEntry,
    async_fire_time_changed_exact,
)

from custom_components.irrigation_scheduler.const import (
    CONF_DEFAULT_DURATION,
    CONF_ENABLED,
    CONF_MAX_DURATION,
    CONF_NAME,
    CONF_SCHEDULES,
    CONF_TARGET_ENTITY_ID,
    DOMAIN,
    SERVICE_WATER_NOW,
)
from custom_components.irrigation_scheduler.scheduler import (
    SHUTDOWN_WATCHDOG_DELAYS,
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


def _stale_run(**overrides) -> dict:
    run_state = {
        "started_at": (dt_util.utcnow() - timedelta(hours=2)).isoformat(),
        "finishes_at": (dt_util.utcnow() - timedelta(hours=1)).isoformat(),
        "duration": 600,
        "source": "schedule",
        "schedule_id": "s1",
        "run_uid": "ORIGINAL-RUN-UID",
        "actuated": True,
        "history_logged": False,
    }
    run_state.update(overrides)
    return run_state


def _populate_store(hass_storage, entry_id: str, run_state: dict) -> None:
    hass_storage[RUNTIME_KEY] = {
        "version": 1,
        "minor_version": 1,
        "key": RUNTIME_KEY,
        "data": {"entries": {entry_id: run_state}},
    }


async def test_watchdog_retries_shutdown_within_the_same_session(
    hass: HomeAssistant, hass_storage
) -> None:
    """A device unreachable at boot is closed by the watchdog, no restart needed.

    Before the fix the failed defensive turn_off was the ONLY attempt of the
    whole session.
    """
    attempts: list[str] = []
    reachable = False

    @callback
    def _turn_off(call):
        attempts.append(call.data["entity_id"])
        if reachable:
            hass.states.async_set("switch.zone1", STATE_OFF)

    hass.services.async_register("homeassistant", "turn_off", _turn_off)
    # Confirmed ON, so the defensive shutdown cannot be considered done.
    hass.states.async_set("switch.zone1", STATE_ON)

    entry_id = "watchdog_retry"
    _populate_store(hass_storage, entry_id, _stale_run())
    entry = _base_entry(entry_id)
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()

    # Boot: one defensive attempt, it did not take, record preserved.
    assert len(attempts) == 1
    store = hass.data[DOMAIN]["store"]
    data = await store.async_load()
    assert data["entries"][entry_id]["run_uid"] == "ORIGINAL-RUN-UID"

    # The device comes back; the first backoff step closes it for real.
    reachable = True
    async_fire_time_changed_exact(
        hass, dt_util.utcnow() + timedelta(seconds=SHUTDOWN_WATCHDOG_DELAYS[0] + 1)
    )
    await hass.async_block_till_done()

    assert len(attempts) == 2
    assert hass.states.get("switch.zone1").state == STATE_OFF
    # Target confirmed off -> the record is settled: history logged once
    # (it had actuated=True, history_logged=False) and the entry dropped.
    data = await store.async_load()
    assert entry_id not in data["entries"]
    history = scheduler_of(entry).history
    assert len(history) == 1
    assert history[0]["run_uid"] == "ORIGINAL-RUN-UID"
    assert history[0]["source"] == "schedule"


async def test_watchdog_settles_when_the_target_reports_itself_off(
    hass: HomeAssistant, hass_storage
) -> None:
    """A target that closes on its own settles the record via the listener,
    without waiting for the next backoff step."""

    @callback
    def _turn_off(call):
        # Never confirms: the device stays unavailable through the attempt.
        return

    hass.services.async_register("homeassistant", "turn_off", _turn_off)
    hass.states.async_set("switch.zone1", STATE_UNAVAILABLE)

    entry_id = "watchdog_listener"
    _populate_store(hass_storage, entry_id, _stale_run())
    entry = _base_entry(entry_id)
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()

    store = hass.data[DOMAIN]["store"]
    assert entry_id in (await store.async_load())["entries"]

    # The device comes back and reports itself CLOSED.
    hass.states.async_set("switch.zone1", STATE_OFF)
    await hass.async_block_till_done()

    data = await store.async_load()
    assert entry_id not in data["entries"]
    assert len(scheduler_of(entry).history) == 1


async def test_watchdog_gives_up_after_the_last_backoff_step(
    hass: HomeAssistant, hass_storage
) -> None:
    """A genuinely dead device is not hammered forever: the watchdog stops
    after the last delay and the record stays for the next boot."""
    attempts: list[str] = []

    @callback
    def _turn_off(call):
        attempts.append(call.data["entity_id"])

    hass.services.async_register("homeassistant", "turn_off", _turn_off)
    hass.states.async_set("switch.zone1", STATE_ON)

    entry_id = "watchdog_giveup"
    _populate_store(hass_storage, entry_id, _stale_run())
    entry = _base_entry(entry_id)
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()

    for delay in SHUTDOWN_WATCHDOG_DELAYS:
        async_fire_time_changed_exact(
            hass, dt_util.utcnow() + timedelta(seconds=delay + 1)
        )
        await hass.async_block_till_done()

    # One boot attempt + one per backoff step, then it stops.
    assert len(attempts) == 1 + len(SHUTDOWN_WATCHDOG_DELAYS)
    async_fire_time_changed_exact(
        hass, dt_util.utcnow() + timedelta(seconds=SHUTDOWN_WATCHDOG_DELAYS[-1] * 2)
    )
    await hass.async_block_till_done()
    assert len(attempts) == 1 + len(SHUTDOWN_WATCHDOG_DELAYS)

    # The durable half of the safety net is untouched.
    data = await hass.data[DOMAIN]["store"].async_load()
    assert data["entries"][entry_id]["run_uid"] == "ORIGINAL-RUN-UID"


async def test_new_run_settles_the_pending_record_instead_of_overwriting_it(
    hass: HomeAssistant, hass_storage
) -> None:
    """REGRESSION: _async_start_run persists with async_save_entry, which
    overwrites unconditionally. A run started while a record was still pending
    a confirmed shutdown therefore destroyed that older run's run_uid, history
    entry and reservoir deduction -- and with it the very record "the next
    boot" was supposed to retry."""

    @callback
    def _turn_off(call):
        # Unconfirmed: the target stays ON, so the record is preserved.
        return

    hass.services.async_register("homeassistant", "turn_off", _turn_off)
    hass.services.async_register("homeassistant", "turn_on", lambda call: None)
    hass.states.async_set("switch.zone1", STATE_ON)

    entry_id = "watchdog_supersede"
    _populate_store(hass_storage, entry_id, _stale_run())
    entry = _base_entry(entry_id)
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()

    sensor_eid = entity_id_of(hass, entry, "sensor", "next_run")
    assert sensor_eid
    await hass.services.async_call(
        DOMAIN, SERVICE_WATER_NOW, {"entity_id": sensor_eid}, blocking=True
    )
    await hass.async_block_till_done()

    scheduler = scheduler_of(entry)
    assert scheduler.is_watering
    # The new run owns the store record...
    data = await hass.data[DOMAIN]["store"].async_load()
    assert data["entries"][entry_id]["run_uid"] != "ORIGINAL-RUN-UID"
    assert data["entries"][entry_id]["source"] == "manual"
    # ...but the interrupted run's accounting was preserved first.
    assert [run["run_uid"] for run in scheduler.history] == ["ORIGINAL-RUN-UID"]


# ---------------------------------------------------------------------------
# A1 (auditoria v0.12.0) - a watchdog must never outlive its own scheduler
# ---------------------------------------------------------------------------
async def test_unload_never_leaves_a_watchdog_behind(
    hass: HomeAssistant, hass_storage
) -> None:
    """REGRESSION: async_unload cleared the watchdog BEFORE _async_finish_run,
    and that very call re-arms one when the target cannot be confirmed off.

    async_call_later is not bound to the config entry, so the timer survived
    the unload holding a reference to the discarded scheduler. On the reload
    that follows it would fire against the NEW instance's target and Store
    record: closing a run it does not own and eating its history/deduction.
    """

    @callback
    def _turn_off(call):
        # Never confirms: the target stays ON through the whole unload.
        return

    hass.services.async_register("homeassistant", "turn_off", _turn_off)
    hass.services.async_register("homeassistant", "turn_on", lambda call: None)
    hass.states.async_set("switch.zone1", STATE_ON)

    entry = _base_entry("watchdog_unload")
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()

    sensor_eid = entity_id_of(hass, entry, "sensor", "next_run")
    assert sensor_eid
    await hass.services.async_call(
        DOMAIN, SERVICE_WATER_NOW, {"entity_id": sensor_eid}, blocking=True
    )
    await hass.async_block_till_done()
    old_scheduler = scheduler_of(entry)
    assert old_scheduler.is_watering

    # Unload while watering, with a target that never confirms off.
    assert await hass.config_entries.async_unload(entry.entry_id)
    await hass.async_block_till_done()

    # No timer may survive the unload, by any path.
    assert old_scheduler._unsub_watchdog is None
    assert not old_scheduler._watchdog_active


async def test_reload_leaves_no_orphan_able_to_touch_the_resumed_run(
    hass: HomeAssistant, hass_storage
) -> None:
    """The A1 scenario end to end, and the reason it needs THREE layers.

    Unload with an unconfirmed shutdown, then reload. The reloaded instance
    RESUMES the very same run (its record is still in the Store with a future
    finishes_at), which is the subtle part: an orphaned watchdog from the old
    scheduler would carry the SAME run_uid as the resumed record, so the
    ownership check alone would happily let it act. What actually protects
    this case is the old scheduler never arming a callback at all -- the
    ``_unloaded`` flag plus the ``finally`` clear in async_unload.

    (An earlier version of this test asserted "no turn_off happens while time
    advances". That was wrong twice over: water_now is a no-op while the
    resumed run is watering, and advancing past the backoff steps crosses that
    run's own finishes_at, so its stop timer fires a perfectly legitimate
    turn_off. Counting service calls cannot tell an orphan apart from the
    real owner; asserting on the orphan's own state can.)
    """
    off_calls: list[str] = []

    @callback
    def _turn_off(call):
        off_calls.append(call.data["entity_id"])

    hass.services.async_register("homeassistant", "turn_off", _turn_off)
    hass.services.async_register("homeassistant", "turn_on", lambda call: None)
    hass.states.async_set("switch.zone1", STATE_ON)

    entry = _base_entry("watchdog_reload")
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    sensor_eid = entity_id_of(hass, entry, "sensor", "next_run")
    assert sensor_eid
    await hass.services.async_call(
        DOMAIN, SERVICE_WATER_NOW, {"entity_id": sensor_eid}, blocking=True
    )
    await hass.async_block_till_done()
    old_scheduler = scheduler_of(entry)
    original_run_uid = old_scheduler._active_run_uid
    assert original_run_uid is not None

    # Unload while watering: every turn_off attempt goes unconfirmed.
    assert await hass.config_entries.async_unload(entry.entry_id)
    await hass.async_block_till_done()
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()

    new_scheduler = scheduler_of(entry)
    assert new_scheduler is not old_scheduler
    # The reloaded instance owns the run now -- the same one, resumed.
    assert new_scheduler.is_watering
    data = await hass.data[DOMAIN]["store"].async_load()
    assert data["entries"][entry.entry_id]["run_uid"] == original_run_uid

    # The discarded scheduler holds nothing that can ever fire...
    assert old_scheduler._unsub_watchdog is None
    assert not old_scheduler._watchdog_active

    # ...and firing its callback by hand is inert, so even a timer that
    # somehow escaped could not close the run the new instance is watering.
    off_calls.clear()
    await old_scheduler._async_watchdog_fired()
    await hass.async_block_till_done()
    assert off_calls == []
    assert new_scheduler.is_watering
    data = await hass.data[DOMAIN]["store"].async_load()
    assert data["entries"][entry.entry_id]["run_uid"] == original_run_uid


async def test_watchdog_stands_down_when_the_record_changed_hands(
    hass: HomeAssistant, hass_storage
) -> None:
    """Ownership check in isolation: a watchdog whose record was replaced by
    another run neither actuates nor settles anything."""
    off_calls: list[str] = []

    @callback
    def _turn_off(call):
        off_calls.append(call.data["entity_id"])

    hass.services.async_register("homeassistant", "turn_off", _turn_off)
    hass.states.async_set("switch.zone1", STATE_ON)

    entry_id = "watchdog_handover"
    _populate_store(hass_storage, entry_id, _stale_run())
    entry = _base_entry(entry_id)
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()

    scheduler = scheduler_of(entry)
    assert scheduler._watchdog_active
    assert scheduler._watchdog_run_uid == "ORIGINAL-RUN-UID"

    # Somebody else claims the entry (simulating the record changing hands
    # while the watchdog callback was still pending).
    store = hass.data[DOMAIN]["store"]
    await store.async_save_entry(
        entry_id, _stale_run(run_uid="SOMEBODY-ELSES-RUN", history_logged=False)
    )

    off_calls.clear()
    async_fire_time_changed_exact(
        hass, dt_util.utcnow() + timedelta(seconds=SHUTDOWN_WATCHDOG_DELAYS[0] + 1)
    )
    await hass.async_block_till_done()

    # It stood down: no turn_off, no history, and the other run's record kept.
    assert off_calls == []
    assert scheduler.history == []
    data = await store.async_load()
    assert data["entries"][entry_id]["run_uid"] == "SOMEBODY-ELSES-RUN"
    assert not scheduler._watchdog_active
