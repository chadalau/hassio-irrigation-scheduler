"""Core scheduling engine for the Irrigation Scheduler integration.

``find_next_run`` (plus ``compute_next_run``, ``resolve_target_services`` and
``off_states``) live in :mod:`irrigation_scheduler.next_run`, a module with
ZERO Home Assistant imports that can be unit tested with plain pytest. This
module imports Home Assistant normally (no ``try/except ImportError`` guard:
a missing/renamed HA symbol must fail loudly at load time, not silently in the
middle of a watering run) and imports from ``next_run`` only what it actually
uses -- importers of ``compute_next_run`` must take it from ``next_run``
itself, which is where it lives and where the pure tests exercise it.

The ``IrrigationScheduler`` class wires that logic to Home Assistant: it
tracks the target entity, actuates it through the correct service for its
domain, persists the volatile run state through the ``RuntimeStore`` and
dispatches entity updates.

Design notes
------------
- ``valve`` targets are actuated through ``valve.open_valve``/``close_valve``
  (there is no ``valve.turn_on``/``turn_off`` in Home Assistant). Other
  supported domains go through ``homeassistant.turn_on``/``turn_off``.
- After issuing a turn-on command the scheduler arms the stop timer IMMEDIATELY
  (never a window with a turn_on sent and no timer to turn the target off) and
  verifies the target actually left its off state with a DEFERRED check that
  runs ``ACTUATION_GRACE`` seconds later. Real devices are async: the service
  returns before the entity state catches up, so an immediate check would
  always see "off". If the target still has not actuated by the grace, the run
  ends loudly and the target is turned off defensively.
- The state-change listener decides by the CURRENT entity state, never by the
  ``new_state`` snapshot carried in the event: with an async device the echo of
  our own turn_off can arrive after a NEW run started, and the stale "off"
  event must not kill that run.
- Reentrancy of the state-change listener is prevented with a monotonically
  increasing run generation token (``_run_id``) compared in the listener, and
  by clearing the in-memory run state before awaiting any target command.
- Optional pH gate: a zone may configure ``ph_entity_id``/``ph_min``/
  ``ph_max`` to only let SCHEDULED runs start while a pH sensor reads inside
  the configured range. It is fail-safe (a missing/unavailable/unparseable
  sensor blocks the run, never waters blindly) and applies ONLY to schedule
  firings -- ``water_now`` is always an explicit manual override and bypasses
  it. A skipped firing is remembered per-schedule-id (``_schedule_warnings``,
  in memory only) so the card can flag it, and clears the next time that
  schedule successfully starts a run.
"""

from __future__ import annotations

import asyncio
import logging
import math
import uuid
from datetime import datetime, timedelta
from functools import partial
from typing import Any, Callable

from homeassistant.core import CoreState, Event, HomeAssistant
from homeassistant.exceptions import ServiceValidationError
from homeassistant.helpers import device_registry as dr
from homeassistant.helpers.dispatcher import async_dispatcher_send
from homeassistant.helpers.event import (
    async_call_later,
    async_track_point_in_time,
    async_track_state_change_event,
)
from homeassistant.util import dt as dt_util

from .const import (
    ACTUATION_GRACE,
    CONF_DEFAULT_DURATION,
    CONF_EC_ENTITY_ID,
    CONF_EC_ENTITY_ID_2,
    CONF_ENABLED,
    CONF_FLOW_RATE_LPH,
    CONF_MAX_DURATION,
    CONF_NAME,
    CONF_NUMBER_OF_POTS,
    CONF_PH_ENTITY_ID,
    CONF_PH_ENTITY_ID_2,
    CONF_PH_MAX,
    CONF_PH_MAX_2,
    CONF_PH_MIN,
    CONF_PH_MIN_2,
    CONF_POT_SENSOR_ENTITY_ID,
    CONF_POT_SENSOR_NAME,
    CONF_POT_SENSORS,
    CONF_RESERVOIR_ACCOUNTED_RUNS,
    CONF_RESERVOIR_REMAINING_L,
    CONF_RESERVOIR_VOLUME_L,
    CONF_SCHEDULE_DURATION,
    CONF_SCHEDULE_ID,
    CONF_SCHEDULES,
    CONF_TARGET_ENTITY_ID,
    DEFAULT_DEFAULT_DURATION,
    DEFAULT_EC_ENTITY_ID,
    DEFAULT_EC_ENTITY_ID_2,
    DEFAULT_ENABLED,
    DEFAULT_FLOW_RATE_LPH,
    DEFAULT_MAX_DURATION,
    DEFAULT_NUMBER_OF_POTS,
    DEFAULT_PH_ENTITY_ID,
    DEFAULT_PH_ENTITY_ID_2,
    DEFAULT_PH_MAX,
    DEFAULT_PH_MAX_2,
    DEFAULT_PH_MIN,
    DEFAULT_PH_MIN_2,
    DEFAULT_POT_SENSORS,
    DEFAULT_RESERVOIR_VOLUME_L,
    DOMAIN,
    HISTORY_MAX_ENTRIES,
    HISTORY_RETENTION_DAYS,
    MAX_SCHEDULE_DURATION,
    MIN_DURATION,
    PH_SCALE_MAX,
    PH_SCALE_MIN,
    SIGNAL_UPDATE,
    SOURCE_EXTERNAL,
    SOURCE_MANUAL,
    SOURCE_SCHEDULE,
)
from .next_run import (
    confirmed_off_states,
    find_next_run,
    off_states,
    resolve_target_services,
)
from .schedules import generate_schedule_id, merge_schedule_update

_LOGGER = logging.getLogger(__name__)

# Hard limit and backoff for the turn_off retry loop in ``_async_finish_run``.
# If the target cannot be CONFIRMED off (current entity state) after all
# attempts, the runtime store entry is KEPT: it is the restart-recovery safety
# net that defensively turns the target off after the next boot.
TURN_OFF_MAX_ATTEMPTS = 3
TURN_OFF_RETRY_DELAY = 1

# Backoff (seconds) for the IN-SESSION shutdown watchdog: the bounded retry
# armed whenever a runtime store record is preserved because the target could
# not be CONFIRMED off (restart recovery's defensive turn_off, the turn_off
# retry loop in _async_finish_run, or an aborted run).
#
# Keeping the record so "the next boot retries" is the durable half of that
# safety net, but on its own it leaves a possibly-open valve with NOTHING
# watching it for the rest of the session -- and the most common cause is a
# device that merely reports ``unavailable`` for a few seconds right after
# startup and then comes back perfectly reachable. The first delays are short
# so that case closes almost immediately; the later ones stretch out so a
# genuinely dead device is not hammered. After the last one the watchdog gives
# up loudly and the record stays for the next boot, as before.
SHUTDOWN_WATCHDOG_DELAYS = (5, 15, 30, 60, 120, 300, 600)

# schedule_warnings text for the two "the target never actuated at all"
# failure shapes (turn_on itself raised, or the target never left its off
# state within ACTUATION_GRACE) -- surfaced on the card exactly like the pH
# gate's warning badge.
WARNING_TARGET_NEVER_ACTUATED = "Tomada não ligou (verifique energia/conexão)"
# schedule_warnings text for a run that DID start but was cut short by a
# confirmed external stop before its scheduled finishes_at -- ambiguous
# between a real power/connectivity loss and an intentional external stop
# (another automation, manual override), but surfaced the same way since
# there is no way to tell them apart from the entity's state alone.
WARNING_TARGET_STOPPED_EARLY = "Tomada desligou durante a rega (verifique energia/conexão)"


class IrrigationScheduler:
    """Per-config-entry scheduler responsible for one irrigation zone."""

    def __init__(
        self,
        hass: HomeAssistant,
        entry: Any,
        store: Any,
    ) -> None:
        """Initialize the scheduler."""
        self.hass = hass
        self.entry = entry
        self.store = store

        # Subscriptions / timers that must all be cancelled on unload.
        self._unsub_next: Callable[[], None] | None = None
        self._unsub_stop: Callable[[], None] | None = None
        self._unsub_actuation: Callable[[], None] | None = None
        self._unsub_state: Callable[[], None] | None = None
        self._unsub_watchdog: Callable[[], None] | None = None

        # Shutdown watchdog: active while a runtime store record is preserved
        # because the target could not be CONFIRMED off. It retries the
        # defensive turn_off on the SHUTDOWN_WATCHDOG_DELAYS backoff and
        # settles the record as soon as the target finally reports itself off
        # (either through a retry or through the state listener).
        self._watchdog_active = False
        self._watchdog_attempt = 0
        # The run this watchdog was armed FOR. Every late action it takes (the
        # physical turn_off and the Store settle) is gated on the runtime
        # record still carrying this exact run_uid, so a callback that outlives
        # its own run can never act on somebody else's.
        self._watchdog_run_uid: str | None = None

        # Set once async_unload() starts. A scheduler being torn down must not
        # arm ANY new callback: async_call_later is not tied to the config
        # entry, so a timer armed during unload outlives this object and would
        # fire against the instance the reload just created.
        self._unloaded = False

        # Active run state (in-memory mirror of the store).
        self._is_watering = False
        self._started_at: datetime | None = None
        self._finishes_at: datetime | None = None
        self._active_duration: int | None = None
        self._active_source: str | None = None
        self._active_schedule_id: str | None = None
        # pH/EC readings AT THE MOMENT the run started (None if not
        # configured/unavailable/unparseable) -- snapshotted here rather than
        # re-read at finish time, since a long run's readings can drift and
        # the value that mattered is the one present when watering began.
        self._active_ph_value: float | None = None
        self._active_ec_value: float | None = None
        # EC's unit varies by sensor (µS/cm, mS/cm, ...) and pH has none, so
        # only EC needs its unit snapshotted alongside the value -- the card
        # always displays pH with a fixed "PH" suffix regardless of what the
        # sensor's own unit says (see ph_entity_id's docstring).
        self._active_ec_unit: str | None = None
        # Same snapshot, for the second (independent) reservoir.
        self._active_ph_value_2: float | None = None
        self._active_ec_value_2: float | None = None
        self._active_ec_unit_2: str | None = None
        # STICKY flag: True once the target has been CONFIRMED actuated at
        # any point since this run started (set by the deferred actuation
        # check, or by the state-change listener observing the target
        # report itself on). Deliberately NOT the same question as "is the
        # target actuated RIGHT NOW": a run that watered for real and was
        # then stopped (by the normal stop timer, a manual stop, or an
        # EXTERNAL actor turning the target off) sees the target off by the
        # time _async_finish_run runs, but water WAS delivered and the run
        # must still be logged to history. Read (and reset) only in
        # _async_finish_run/_async_abort_run.
        self._active_actuated = False

        # Stable persisted identifier for exactly-once history/accounting.
        # Unlike the in-memory generation counter this survives a restart.
        self._active_run_uid: str | None = None

        # When we issue our own turn_on/turn_off we must not react to it.
        self._suppress_state_listener = False
        self._suppress_options_dispatch_once = False

        # Run generation token: incremented on every run start and finish. The
        # state-change listener captures it when the event fires and passes it
        # back, so a stale/reordered callback can never finish the wrong run.
        self._run_id = 0

        # Next scheduled fire.
        self._next_run: datetime | None = None
        self._next_schedule: dict[str, Any] | None = None

        # Per-schedule pH-gate warnings (schedule_id -> reason), kept in
        # memory only (informational UI hint, not restart-critical). A
        # schedule enters this dict when a SCHEDULED firing is skipped
        # because the pH gate blocked it, and leaves it the next time that
        # same schedule successfully starts a run (or is removed).
        self._schedule_warnings: dict[str, str] = {}

        # Completed-run history (most-recent-first), an in-memory mirror of
        # the persisted log loaded once in async_setup() and updated on every
        # append -- read synchronously by the last_run/history properties,
        # same pattern as _schedule_warnings.
        self._history: list[dict[str, Any]] = []

    # ------------------------------------------------------------------
    # Public properties
    # ------------------------------------------------------------------
    @property
    def enabled(self) -> bool:
        """Whether scheduling is enabled for this zone."""
        value = self.entry.options.get(CONF_ENABLED, DEFAULT_ENABLED)
        if not isinstance(value, bool):
            _LOGGER.warning(
                "Invalid enabled value %r in options for %s; using default %s",
                value,
                self.entry.entry_id,
                DEFAULT_ENABLED,
            )
            return DEFAULT_ENABLED
        return value

    @property
    def schedules(self) -> list[dict[str, Any]]:
        """The list of schedules configured for this zone.

        Malformed items (non-dict, or with a ``duration`` that is not a
        genuine in-range integer) are filtered out so corrupted options can
        never crash ``_reschedule_next`` / ``find_next_run`` / the plain
        ``int(schedule[CONF_SCHEDULE_DURATION])`` cast in
        ``_async_schedule_fired`` -- a schedule that fails that cast raises
        BEFORE ``_reschedule_next()`` runs, which would silently stop the
        zone from ever scheduling again until restart or an options change.
        """
        raw = self.entry.options.get(CONF_SCHEDULES, [])
        if not isinstance(raw, (list, tuple)):
            _LOGGER.warning(
                "Invalid schedules in options for %s (expected a list); "
                "ignoring them",
                self.entry.entry_id,
            )
            return []
        schedules = [
            item
            for item in raw
            if isinstance(item, dict) and self._is_valid_schedule_duration(item)
        ]
        if len(schedules) != len(raw):
            _LOGGER.warning(
                "Filtered %d malformed schedule item(s) for %s",
                len(raw) - len(schedules),
                self.entry.entry_id,
            )
        return schedules

    @staticmethod
    def _is_valid_schedule_duration(item: dict[str, Any]) -> bool:
        """Whether ``item[CONF_SCHEDULE_DURATION]`` is a genuine in-range int.

        ``time``/``days`` are intentionally NOT validated here: ``next_run``'s
        ``find_next_run`` already degrades a bad time/days gracefully (skips
        the candidate). ``duration`` is the one field cast with a bare
        ``int()`` outside that module, so it is the one that needs filtering
        at the source.
        """
        duration = item.get(CONF_SCHEDULE_DURATION)
        return (
            isinstance(duration, int)
            and not isinstance(duration, bool)
            and MIN_DURATION <= duration <= MAX_SCHEDULE_DURATION
        )

    @property
    def is_watering(self) -> bool:
        """Whether a watering run is currently active."""
        return self._is_watering

    @property
    def started_at(self) -> datetime | None:
        """When the active run started (UTC), or None."""
        return self._started_at

    @property
    def finishes_at(self) -> datetime | None:
        """When the active run finishes (UTC), or None."""
        return self._finishes_at

    @property
    def active_source(self) -> str | None:
        """Source of the active run: 'schedule' or 'manual'."""
        return self._active_source

    @property
    def active_schedule_id(self) -> str | None:
        """ID of the schedule that triggered the active run, if any."""
        return self._active_schedule_id

    @property
    def active_duration(self) -> int | None:
        """Duration in seconds of the active run (clamped), or None."""
        return self._active_duration

    @property
    def next_run(self) -> datetime | None:
        """Next scheduled run datetime, or None."""
        return self._next_run

    @property
    def target_entity_id(self) -> str:
        """Entity id of the valve/switch controlled by this zone."""
        return self.entry.data[CONF_TARGET_ENTITY_ID]

    @property
    def target_domain(self) -> str:
        """Domain of the target entity (e.g. 'valve', 'switch', 'light')."""
        return self.target_entity_id.split(".", 1)[0]

    @property
    def default_duration(self) -> int:
        """Default watering duration in seconds."""
        return self._duration_option(CONF_DEFAULT_DURATION, DEFAULT_DEFAULT_DURATION)

    @property
    def max_duration(self) -> int:
        """Maximum watering duration in seconds (watchdog clamp)."""
        return self._duration_option(CONF_MAX_DURATION, DEFAULT_MAX_DURATION)

    @property
    def flow_rate_lph(self) -> int:
        """Watering flow rate in liters per hour (0 = unknown/disabled)."""
        try:
            value = self.entry.options.get(CONF_FLOW_RATE_LPH, DEFAULT_FLOW_RATE_LPH)
            if isinstance(value, int) and not isinstance(value, bool) and value >= 0:
                return value
        except (TypeError, ValueError):
            pass
        _LOGGER.warning(
            "Invalid flow_rate_lph in options for %s; using default %s",
            self.entry.entry_id,
            DEFAULT_FLOW_RATE_LPH,
        )
        return DEFAULT_FLOW_RATE_LPH

    @property
    def number_of_pots(self) -> int:
        """Number of pots/plants watered by the zone (0 = unknown/disabled)."""
        try:
            value = self.entry.options.get(CONF_NUMBER_OF_POTS, DEFAULT_NUMBER_OF_POTS)
            if isinstance(value, int) and not isinstance(value, bool) and value >= 0:
                return value
        except (TypeError, ValueError):
            pass
        _LOGGER.warning(
            "Invalid number_of_pots in options for %s; using default %s",
            self.entry.entry_id,
            DEFAULT_NUMBER_OF_POTS,
        )
        return DEFAULT_NUMBER_OF_POTS

    @property
    def pot_sensors(self) -> list[dict[str, str]]:
        """Ordered pot moisture sensors configured for the compact card grid."""
        value = self.entry.options.get(CONF_POT_SENSORS, DEFAULT_POT_SENSORS)
        if not isinstance(value, list):
            _LOGGER.warning(
                "Invalid pot_sensors in options for %s; using an empty list",
                self.entry.entry_id,
            )
            return []
        result: list[dict[str, str]] = []
        seen: set[str] = set()
        for item in value:
            if not isinstance(item, dict):
                continue
            name = item.get(CONF_POT_SENSOR_NAME)
            entity_id = item.get(CONF_POT_SENSOR_ENTITY_ID)
            if (
                not isinstance(name, str)
                or not name.strip()
                or not isinstance(entity_id, str)
                or not entity_id.startswith("sensor.")
                or entity_id in seen
            ):
                continue
            seen.add(entity_id)
            result.append(
                {
                    CONF_POT_SENSOR_NAME: name.strip(),
                    CONF_POT_SENSOR_ENTITY_ID: entity_id,
                }
            )
        return result

    @property
    def reservoir_volume_l(self) -> int:
        """Water reservoir volume in liters (0 = not configured)."""
        try:
            value = self.entry.options.get(
                CONF_RESERVOIR_VOLUME_L, DEFAULT_RESERVOIR_VOLUME_L
            )
            if isinstance(value, int) and not isinstance(value, bool) and value >= 0:
                return value
        except (TypeError, ValueError):
            pass
        _LOGGER.warning(
            "Invalid reservoir_volume_l in options for %s; using default %s",
            self.entry.entry_id,
            DEFAULT_RESERVOIR_VOLUME_L,
        )
        return DEFAULT_RESERVOIR_VOLUME_L

    @property
    def reservoir_remaining_l(self) -> float:
        """Water remaining in the reservoir (liters).

        Absent from options until the first deduction (a completed run) or
        refill -- treated as FULL (== reservoir_volume_l) until then, so a
        zone that just enabled tracking does not start at an arbitrary
        stored value. Clamped to ``[0, reservoir_volume_l]``: the volume
        itself may have been lowered since the value was last written.
        """
        capacity = float(self.reservoir_volume_l)
        try:
            value = self.entry.options.get(CONF_RESERVOIR_REMAINING_L)
            if value is None:
                return capacity
            if isinstance(value, (int, float)) and not isinstance(value, bool):
                return max(0.0, min(float(value), capacity))
        except (TypeError, ValueError):
            pass
        _LOGGER.warning(
            "Invalid reservoir_remaining_l in options for %s; treating as full",
            self.entry.entry_id,
        )
        return capacity

    @property
    def ph_entity_id(self) -> str:
        """Entity id of the pH sensor gating scheduled runs ("" = disabled)."""
        value = self.entry.options.get(CONF_PH_ENTITY_ID, DEFAULT_PH_ENTITY_ID)
        if isinstance(value, str):
            return value
        _LOGGER.warning(
            "Invalid ph_entity_id in options for %s; using default %r",
            self.entry.entry_id,
            DEFAULT_PH_ENTITY_ID,
        )
        return DEFAULT_PH_ENTITY_ID

    @property
    def ec_entity_id(self) -> str:
        """Entity id of an EC (conductivity) sensor ("" = not configured).

        DISPLAY-ONLY: unlike ``ph_entity_id`` this never gates scheduled
        runs; it only lets the card show a live reading and open its history.
        """
        value = self.entry.options.get(CONF_EC_ENTITY_ID, DEFAULT_EC_ENTITY_ID)
        if isinstance(value, str):
            return value
        _LOGGER.warning(
            "Invalid ec_entity_id in options for %s; using default %r",
            self.entry.entry_id,
            DEFAULT_EC_ENTITY_ID,
        )
        return DEFAULT_EC_ENTITY_ID

    @property
    def ph_min(self) -> float:
        """Minimum pH (inclusive) that allows a scheduled run to start."""
        return self._ph_option(CONF_PH_MIN, DEFAULT_PH_MIN)

    @property
    def ph_max(self) -> float:
        """Maximum pH (inclusive) that allows a scheduled run to start."""
        return self._ph_option(CONF_PH_MAX, DEFAULT_PH_MAX)

    @property
    def ph_entity_id_2(self) -> str:
        """Entity id of the SECOND reservoir's pH sensor ("" = disabled).

        Independent of ``ph_entity_id``: a single target/pump can draw from
        two physically distinct reservoirs, each with its own pH. Fail-safe
        and gates scheduled runs exactly like ``ph_entity_id`` -- see
        ``_check_ph_gate``.
        """
        value = self.entry.options.get(CONF_PH_ENTITY_ID_2, DEFAULT_PH_ENTITY_ID_2)
        if isinstance(value, str):
            return value
        _LOGGER.warning(
            "Invalid ph_entity_id_2 in options for %s; using default %r",
            self.entry.entry_id,
            DEFAULT_PH_ENTITY_ID_2,
        )
        return DEFAULT_PH_ENTITY_ID_2

    @property
    def ec_entity_id_2(self) -> str:
        """Entity id of the second reservoir's EC sensor ("" = not configured).

        DISPLAY-ONLY, like ``ec_entity_id``.
        """
        value = self.entry.options.get(CONF_EC_ENTITY_ID_2, DEFAULT_EC_ENTITY_ID_2)
        if isinstance(value, str):
            return value
        _LOGGER.warning(
            "Invalid ec_entity_id_2 in options for %s; using default %r",
            self.entry.entry_id,
            DEFAULT_EC_ENTITY_ID_2,
        )
        return DEFAULT_EC_ENTITY_ID_2

    @property
    def ph_min_2(self) -> float:
        """Minimum pH (inclusive) for the second reservoir."""
        return self._ph_option(CONF_PH_MIN_2, DEFAULT_PH_MIN_2)

    @property
    def ph_max_2(self) -> float:
        """Maximum pH (inclusive) for the second reservoir."""
        return self._ph_option(CONF_PH_MAX_2, DEFAULT_PH_MAX_2)

    @property
    def schedule_warnings(self) -> dict[str, str]:
        """Schedule ids currently flagged because the pH gate skipped them."""
        return dict(self._schedule_warnings)

    @property
    def history(self) -> list[dict[str, Any]]:
        """Completed-run history for this zone, most-recent-first.

        Each record: ``started_at``/``finishes_at`` (iso, ACTUAL times -- a
        run stopped early reflects its real duration, not the originally
        scheduled one), ``duration`` (seconds), ``source``, ``schedule_id``,
        and a ``flow_rate_lph``/``number_of_pots`` SNAPSHOT taken when the
        run finished, so historical volume stays accurate even if those
        zone settings change later.
        """
        return list(self._history)

    @property
    def last_run(self) -> dict[str, Any] | None:
        """The most recent completed run, or None if there is no history yet."""
        return self._history[0] if self._history else None

    def _ph_option(self, key: str, default: float) -> float:
        """Return a validated pH bound (0..14) from options, or ``default``."""
        try:
            value = self.entry.options.get(key, default)
            if (
                isinstance(value, (int, float))
                and not isinstance(value, bool)
                and PH_SCALE_MIN <= value <= PH_SCALE_MAX
            ):
                return float(value)
        except (TypeError, ValueError):
            pass
        _LOGGER.warning(
            "Invalid %s in options for %s; using default %s",
            key,
            self.entry.entry_id,
            default,
        )
        return default

    def _duration_option(self, key: str, default: int) -> int:
        """Return a validated duration option (seconds) or ``default``.

        The option is honored only when it is a genuine integer (``bool`` is
        rejected -- ``True``/``False`` subclass ``int`` in Python) inside the
        ``[MIN_DURATION, MAX_SCHEDULE_DURATION]`` interval. Anything else --
        strings, floats that ``int()`` would silently truncate (e.g. ``3.7``),
        or out-of-range values like ``0``/``-5`` -- falls back to ``default``
        with a warning instead of yielding a semantically invalid duration.
        """
        try:
            value = self.entry.options.get(key, default)
            if (
                isinstance(value, int)
                and not isinstance(value, bool)
                and MIN_DURATION <= value <= MAX_SCHEDULE_DURATION
            ):
                return value
        except (TypeError, ValueError):
            pass
        _LOGGER.warning(
            "Invalid %s in options for %s; using default %s",
            key,
            self.entry.entry_id,
            default,
        )
        return default

    # ------------------------------------------------------------------
    # Setup / teardown
    # ------------------------------------------------------------------
    async def async_setup(self) -> None:
        """Recover any interrupted run and schedule the next firing."""
        self._history = await self.store.async_load_history(
            self.entry.entry_id,
            max_age_days=HISTORY_RETENTION_DAYS,
            max_entries=HISTORY_MAX_ENTRIES,
        )
        recovery_pending = await self._async_recover_state()
        self._unsub_state = async_track_state_change_event(
            self.hass, [self.target_entity_id], self._async_target_state_changed
        )
        # Close the event-only blind spot: the target may already be on when
        # this integration starts (HA was down, or the entity loaded first).
        if not self._is_watering and not recovery_pending:
            await self._async_maybe_start_external_run()
        self._reschedule_next()

    async def async_unload(self) -> None:
        """Cancel all timers/listeners and stop watering (unless HA is stopping)."""
        # Flagged FIRST: _async_finish_run below can reach the "target could
        # not be confirmed off" branch, which arms a FRESH watchdog. An
        # async_call_later is not bound to the config entry, so that timer
        # would outlive this scheduler and fire with ``self`` still pointing at
        # the discarded instance -- turning off a target the RELOADED instance
        # may already be watering, and settling a Store record that by then
        # belongs to its run. Nothing is lost by refusing to arm here: the
        # record survives in the Store and the reloaded instance arms its own
        # watchdog from it in _async_recover_state.
        self._unloaded = True
        self._cancel_next()
        self._cancel_stop()
        self._cancel_actuation()
        # The preserved record stays in the Store (the next boot re-arms the
        # watchdog through _async_recover_state); only the timer goes.
        self._async_clear_shutdown_watchdog()
        if self._unsub_state is not None:
            self._unsub_state()
            self._unsub_state = None

        if self._is_watering:
            if self.hass.state is CoreState.stopping:
                # Leave the store intact so the next boot can recover the run.
                _LOGGER.debug(
                    "Home Assistant is stopping; leaving watering state in store"
                )
                return
            try:
                await self._async_finish_run(turn_off=True, remove_state=True)
            finally:
                # Belt and braces: the flag above already refuses to arm, but a
                # timer must never survive this method by any path.
                self._async_clear_shutdown_watchdog()

    # ------------------------------------------------------------------
    # Public control methods
    # ------------------------------------------------------------------
    async def async_set_enabled(self, enabled: bool) -> None:
        """Enable or disable the whole schedule (stored in entry.options)."""
        options = dict(self.entry.options)
        options[CONF_ENABLED] = enabled
        self.hass.config_entries.async_update_entry(self.entry, options=options)
        # The entry update listener calls async_options_updated() -- it must
        # NOT reload the entry (that would kill an active watering run).

    async def async_set_schedules(self, schedules: list[dict[str, Any]]) -> None:
        """Replace the full schedule list (stored in entry.options)."""
        self._validate_schedule_slots(schedules)
        options = dict(self.entry.options)
        options[CONF_SCHEDULES] = schedules
        self.hass.config_entries.async_update_entry(self.entry, options=options)

    def _validate_schedule_slots(self, schedules: list[dict[str, Any]]) -> None:
        """Reject enabled schedules that compete for the same wall-clock slot.

        The scheduler selects one item for a timestamp; accepting two would
        silently starve every item after the first forever.
        """
        occupied: dict[tuple[int, str], str] = {}
        for schedule in schedules:
            if not schedule.get(CONF_ENABLED, True):
                continue
            schedule_time = str(schedule.get("time", ""))
            schedule_id = str(schedule.get(CONF_SCHEDULE_ID, "<new>"))
            days = schedule.get("days", [])
            if not isinstance(days, (list, tuple)):
                continue
            for day in days:
                # A day that is not hashable (a list/dict from a hand-edited
                # or corrupted options payload) would raise TypeError on the
                # dict lookup below and take down the whole service call.
                # Skip it like every other malformed field is skipped -- the
                # ``schedules`` property and ``find_next_run`` already ignore
                # such an item, so it can never fire either way.
                if not isinstance(day, int) or isinstance(day, bool):
                    continue
                slot = (day, schedule_time)
                existing = occupied.get(slot)
                if existing is not None:
                    raise ServiceValidationError(
                        f"Schedules {existing!r} and {schedule_id!r} overlap "
                        f"on day {day} at {schedule_time}"
                    )
                occupied[slot] = schedule_id

    async def async_set_zone_name(self, name: str) -> None:
        """Rename the zone from the card, without reloading the entry.

        The name lives in ``entry.data`` (not options) because it is identity,
        not a setting: it feeds the device name, and through
        ``_attr_has_entity_name`` every entity's friendly_name. Three places
        have to agree or the rename only half-lands:

        - ``entry.data[CONF_NAME]``, so a later reload rebuilds the same name;
        - the entry TITLE, which is what Settings -> Devices & services lists;
        - the device registry entry, which is what takes effect RIGHT NOW.
          Without it the new name would only appear after a restart, since
          DeviceInfo is only read while entities are being created.

        Entity ids are deliberately left alone. Home Assistant does not rename
        them when a device is renamed either, and rewriting them would break
        every dashboard, automation and script that points at this zone --
        including the card's own ``entity:`` config.
        """
        clean = name.strip()
        if not clean:
            raise ServiceValidationError("O nome da zona não pode ficar vazio")
        if len(clean) > 64:
            raise ServiceValidationError(
                "O nome da zona deve ter no máximo 64 caracteres"
            )
        if clean == self.entry.data.get(CONF_NAME):
            return

        self.hass.config_entries.async_update_entry(
            self.entry,
            data={**dict(self.entry.data), CONF_NAME: clean},
            title=clean,
        )
        device_registry = dr.async_get(self.hass)
        device = device_registry.async_get_device(
            identifiers={(DOMAIN, self.entry.entry_id)}
        )
        if device is not None:
            device_registry.async_update_device(device.id, name=clean)
        _LOGGER.info("Zone %s renamed to %r", self.entry.entry_id, clean)

    async def async_set_zone_options(
        self,
        *,
        default_duration: int | None = None,
        flow_rate_lph: int | None = None,
        number_of_pots: int | None = None,
        reservoir_volume_l: int | None = None,
        ph_entity_id: str | None = None,
        ph_min: float | None = None,
        ph_max: float | None = None,
        ec_entity_id: str | None = None,
        ph_entity_id_2: str | None = None,
        ph_min_2: float | None = None,
        ph_max_2: float | None = None,
        ec_entity_id_2: str | None = None,
        pot_sensors: list[dict[str, str]] | None = None,
    ) -> None:
        """Update optional zone settings (duration / flow rate / pots / reservoir / pH gate / EC).

        Only the fields that are not ``None`` are changed; the rest of the
        options are preserved. ``ph_entity_id=""``/``ec_entity_id=""``
        (and their R2 counterparts) explicitly clear those (an empty string
        is a valid, meaningful value here -- it is only skipped when the
        caller passes ``None``, i.e. "leave unchanged"). ``ec_entity_id``/
        ``ec_entity_id_2`` are DISPLAY-ONLY: they never gate anything, they
        only feed the card's EC badges. The entry is NOT reloaded (the
        update listener only recalculates the next firing).

        Validates ``ph_min``/``ph_max`` (and ``ph_min_2``/``ph_max_2``)
        against the EFFECTIVE resulting range (this patch merged onto the
        currently stored values), not just the fields present in this call:
        a call that only raises ``ph_min`` above an already-stored
        ``ph_max`` is just as invalid as sending both inverted in the same
        call, and would otherwise silently create an impossible range that
        blocks every scheduled run with no visible error until someone
        notices the pH warning badge. ``default_duration`` is validated the
        same way against the stored ``max_duration``.
        """
        if ph_min is not None or ph_max is not None:
            effective_min = ph_min if ph_min is not None else self.ph_min
            effective_max = ph_max if ph_max is not None else self.ph_max
            if effective_min > effective_max:
                raise ServiceValidationError(
                    f"ph_min ({effective_min:g}) must not be greater than "
                    f"ph_max ({effective_max:g})"
                )
        if ph_min_2 is not None or ph_max_2 is not None:
            effective_min_2 = ph_min_2 if ph_min_2 is not None else self.ph_min_2
            effective_max_2 = ph_max_2 if ph_max_2 is not None else self.ph_max_2
            if effective_min_2 > effective_max_2:
                raise ServiceValidationError(
                    f"ph_min_2 ({effective_min_2:g}) must not be greater than "
                    f"ph_max_2 ({effective_max_2:g})"
                )
        if default_duration is not None and default_duration > self.max_duration:
            raise ServiceValidationError(
                f"default_duration ({default_duration}s) must not exceed "
                f"max_duration ({self.max_duration}s)"
            )

        options = dict(self.entry.options)
        if default_duration is not None:
            options[CONF_DEFAULT_DURATION] = default_duration
        if flow_rate_lph is not None:
            options[CONF_FLOW_RATE_LPH] = flow_rate_lph
        if number_of_pots is not None:
            options[CONF_NUMBER_OF_POTS] = number_of_pots
        if reservoir_volume_l is not None:
            options[CONF_RESERVOIR_VOLUME_L] = reservoir_volume_l
        if ph_entity_id is not None:
            options[CONF_PH_ENTITY_ID] = ph_entity_id
        if ec_entity_id is not None:
            options[CONF_EC_ENTITY_ID] = ec_entity_id
        if ph_min is not None:
            options[CONF_PH_MIN] = ph_min
        if ph_max is not None:
            options[CONF_PH_MAX] = ph_max
        if ph_entity_id_2 is not None:
            options[CONF_PH_ENTITY_ID_2] = ph_entity_id_2
        if ec_entity_id_2 is not None:
            options[CONF_EC_ENTITY_ID_2] = ec_entity_id_2
        if ph_min_2 is not None:
            options[CONF_PH_MIN_2] = ph_min_2
        if ph_max_2 is not None:
            options[CONF_PH_MAX_2] = ph_max_2
        if pot_sensors is not None:
            options[CONF_POT_SENSORS] = [dict(item) for item in pot_sensors]
        # Explicitly disabling a reservoir's gate: any warning it could have
        # caused is now stale (the next scheduled fire would clear it
        # anyway, but leaving a "!" badge up after the user just turned the
        # gate off is confusing). Reasons are prefixed "R1: "/"R2: " ONLY
        # when both reservoirs are in play (see _check_ph_gate), so that
        # prefix is used to clear just the disabled reservoir's warnings
        # when the OTHER one is still configured -- disabling R2 must not
        # also wipe an R1 warning that is still perfectly valid. When the
        # reservoir being disabled was the only one ever gating anything,
        # its warnings carry no prefix at all, so a full clear is correct.
        if ph_entity_id == "":
            other_configured = (
                ph_entity_id_2 if ph_entity_id_2 is not None else self.ph_entity_id_2
            )
            if other_configured:
                self._schedule_warnings = {
                    sid: reason
                    for sid, reason in self._schedule_warnings.items()
                    if not reason.startswith("R1: ")
                }
            else:
                self._schedule_warnings.clear()
        if ph_entity_id_2 == "":
            other_configured = (
                ph_entity_id if ph_entity_id is not None else self.ph_entity_id
            )
            if other_configured:
                self._schedule_warnings = {
                    sid: reason
                    for sid, reason in self._schedule_warnings.items()
                    if not reason.startswith("R2: ")
                }
            else:
                self._schedule_warnings.clear()
        self.hass.config_entries.async_update_entry(self.entry, options=options)

    async def async_refill_reservoir(self) -> None:
        """Reset the tracked remaining volume back to full capacity.

        The entry update listener calls async_options_updated() (dispatch +
        reschedule), same as async_set_enabled/async_set_zone_options.
        """
        options = {
            **dict(self.entry.options),
            CONF_RESERVOIR_REMAINING_L: float(self.reservoir_volume_l),
        }
        self.hass.config_entries.async_update_entry(self.entry, options=options)

    def _deduct_reservoir_volume(
        self, liters: float, run_uid: str | None = None
    ) -> None:
        """Subtract ``liters`` actually delivered from the tracked remaining
        volume, clamped at 0. No-op when the zone has no reservoir volume
        configured (0) -- there is nothing to track. Called ONLY for runs
        already confirmed to have delivered water (see _async_log_history),
        the same fail-safe gate the history log itself relies on.
        """
        if self.reservoir_volume_l <= 0 or liters <= 0:
            return
        accounted = self.entry.options.get(CONF_RESERVOIR_ACCOUNTED_RUNS, [])
        if not isinstance(accounted, list):
            accounted = []
        if run_uid is not None and run_uid in accounted:
            return
        new_remaining = max(0.0, self.reservoir_remaining_l - liters)
        options = {
            **dict(self.entry.options),
            CONF_RESERVOIR_REMAINING_L: new_remaining,
        }
        if run_uid is not None:
            options[CONF_RESERVOIR_ACCOUNTED_RUNS] = [
                run_uid,
                *[item for item in accounted if isinstance(item, str) and item != run_uid],
            ][:HISTORY_MAX_ENTRIES]
        # The flag is a ONE-SHOT consumed by the update listener, so it must
        # only stay set when a listener is actually going to run:
        # async_update_entry returns False WITHOUT calling any listener when
        # the resulting options are identical to the stored ones (e.g. a
        # legacy record with no run_uid deducting against an already-empty
        # reservoir). Left set, it would silently swallow the NEXT genuine
        # options change -- no reschedule, no card refresh.
        self._suppress_options_dispatch_once = True
        if not self.hass.config_entries.async_update_entry(
            self.entry, options=options
        ):
            self._suppress_options_dispatch_once = False

    async def async_add_schedule(self, schedule: dict[str, Any]) -> None:
        """Append a schedule to the current list.

        ``id`` is optional in the service schema (``set_schedules`` relies on
        that to preserve ids of existing items), so a caller other than the
        card's own "add" dialog could in principle supply one that collides
        with an existing schedule. A fresh id is generated instead of
        silently creating a duplicate: ids must stay unique for
        ``async_update_schedule``/``async_remove_schedule`` to target the
        right entry.
        """
        existing_ids = {s.get(CONF_SCHEDULE_ID) for s in self.schedules}
        schedule_id = schedule.get(CONF_SCHEDULE_ID)
        if schedule_id is None or schedule_id in existing_ids:
            schedule = {**schedule, CONF_SCHEDULE_ID: generate_schedule_id()}
        await self.async_set_schedules([*self.schedules, schedule])

    async def async_update_schedule(
        self, schedule_id: str, **fields: Any
    ) -> None:
        """Update the given fields of an existing schedule.

        The schedule ``id`` is immutable after creation: it is never injected,
        replaced or removed here (``merge_schedule_update`` ignores it).
        Raises ``ServiceValidationError`` if no schedule has ``schedule_id``
        instead of silently doing nothing -- a typo'd id from an automation
        or script should surface as an error, not vanish.
        """
        if not any(s.get(CONF_SCHEDULE_ID) == schedule_id for s in self.schedules):
            raise ServiceValidationError(
                f"No schedule with id {schedule_id!r} for {self.entry.entry_id}"
            )
        schedules: list[dict[str, Any]] = []
        for schedule in self.schedules:
            if schedule.get(CONF_SCHEDULE_ID) == schedule_id:
                schedules.append(merge_schedule_update(schedule, fields))
            else:
                schedules.append(schedule)
        await self.async_set_schedules(schedules)

    async def async_remove_schedule(self, schedule_id: str) -> None:
        """Remove a schedule by its id.

        Raises ``ServiceValidationError`` if no schedule has ``schedule_id``
        (see ``async_update_schedule`` for why this is not a silent no-op).
        """
        if not any(s.get(CONF_SCHEDULE_ID) == schedule_id for s in self.schedules):
            raise ServiceValidationError(
                f"No schedule with id {schedule_id!r} for {self.entry.entry_id}"
            )
        self._schedule_warnings.pop(schedule_id, None)
        await self.async_set_schedules(
            [s for s in self.schedules if s.get(CONF_SCHEDULE_ID) != schedule_id]
        )

    async def async_water_now(self, duration: int | None = None) -> None:
        """Start watering immediately for the given duration (default: zone default)."""
        await self._async_start_run(
            duration=duration if duration is not None else self.default_duration,
            source=SOURCE_MANUAL,
            schedule_id=None,
        )

    async def async_stop(self) -> None:
        """Stop the active watering run (turn the target off and clear state)."""
        if not self._is_watering and self._async_target_is_actuated():
            # A previous Store failure or a target already-on before setup
            # must not make the integration's emergency stop a no-op.
            self._suppress_state_listener = True
            try:
                await self._async_call_target_service(False)
            finally:
                self._suppress_state_listener = False
            return
        await self._async_finish_run(turn_off=True, remove_state=True)

    async def async_options_updated(self) -> None:
        """React to entry.options changes without reloading the entry.

        Only the next firing is recalculated; an active watering run is never
        interrupted by a reload.
        """
        if self._suppress_options_dispatch_once:
            self._suppress_options_dispatch_once = False
            return
        self._reschedule_next()
        self._async_dispatch_update()

    # ------------------------------------------------------------------
    # Run lifecycle
    # ------------------------------------------------------------------
    async def _async_start_run(
        self,
        duration: int,
        source: str,
        schedule_id: str | None,
    ) -> None:
        """Start a watering run. Never stacks runs on top of each other."""
        if self._is_watering:
            _LOGGER.debug(
                "Ignoring start request: a watering run is already active "
                "for entry %s",
                self.entry.entry_id,
            )
            return

        if schedule_id is not None:
            # This schedule is about to water: any pH-gate warning it carried
            # from a previous skipped firing no longer applies.
            self._schedule_warnings.pop(schedule_id, None)

        # Resolved BEFORE any state mutation below: an unsupported
        # ``target_domain`` (only possible via a hand-edited/corrupted config
        # entry -- the config flow restricts it to the supported domains)
        # must fail loudly here rather than after the zone is already marked
        # "watering", which would otherwise leave it stuck with no timer to
        # ever clear it.
        service_domain, turn_on_service, _ = resolve_target_services(
            self.target_domain
        )

        # Security watchdog: clamp to 1..max_duration.
        duration = max(MIN_DURATION, min(int(duration), self.max_duration))

        now_utc = dt_util.utcnow()
        finishes_utc = now_utc + timedelta(seconds=duration)
        run_uid = uuid.uuid4().hex

        # Capture this run's generation token: the deferred actuation check
        # (and any other callback racing this run) validates against it.
        self._run_id += 1
        run_id = self._run_id
        self._is_watering = True
        self._started_at = now_utc
        self._finishes_at = finishes_utc
        self._active_duration = duration
        self._active_source = source
        self._active_schedule_id = schedule_id
        self._active_ph_value = self._read_sensor_value(self.ph_entity_id)
        self._active_ec_value = self._read_sensor_value(self.ec_entity_id)
        self._active_ec_unit = self._read_sensor_unit(self.ec_entity_id)
        self._active_ph_value_2 = self._read_sensor_value(self.ph_entity_id_2)
        self._active_ec_value_2 = self._read_sensor_value(self.ec_entity_id_2)
        self._active_ec_unit_2 = self._read_sensor_unit(self.ec_entity_id_2)
        self._active_actuated = False
        self._active_run_uid = run_uid

        # A record preserved by a shutdown that was never confirmed is about
        # to be overwritten by async_save_entry below (unlike the external
        # path, a deliberate start owns the target from here on, and its own
        # stop timer is what closes it). Settle that older run's accounting
        # FIRST: its run_uid, history entry and reservoir deduction would
        # otherwise be destroyed silently, and "the next boot retries" would
        # never happen because the record it needed is gone. Placed after
        # _is_watering was set (no concurrent start can slip through this
        # await) and before the record is replaced.
        if self._watchdog_active:
            await self._async_resolve_pending_record()
            self._async_clear_shutdown_watchdog()

        try:
            await self.store.async_save_entry(
                self.entry.entry_id,
                {
                    "started_at": now_utc.isoformat(),
                    "finishes_at": finishes_utc.isoformat(),
                    "duration": duration,
                    "source": source,
                    "schedule_id": schedule_id,
                    "ph_value": self._active_ph_value,
                    "ec_value": self._active_ec_value,
                    "ec_unit": self._active_ec_unit,
                    "ph_value_2": self._active_ph_value_2,
                    "ec_value_2": self._active_ec_value_2,
                    "ec_unit_2": self._active_ec_unit_2,
                    # Persisted mirror of the in-memory ``_active_actuated``
                    # sticky flag: without it, restart recovery (which has no
                    # in-memory state to consult) cannot tell a run that
                    # genuinely watered and crashed apart from one that
                    # crashed before turn_on ever took effect. Flipped to
                    # True via _async_store_mark_actuated() at the same
                    # points the in-memory flag is set.
                    "actuated": False,
                    "run_uid": run_uid,
                },
            )
        except Exception as err:  # noqa: BLE001 - revert, never leave the zone stuck
            # turn_on has NOT been sent yet at this point, so there is no
            # physical risk -- but _is_watering was already set True above,
            # with no timer armed. Left as-is, the zone would show "Regando"
            # forever (every future water_now/scheduled fire sees
            # _is_watering=True and no-ops) until a reload/restart. Revert
            # fully instead, exactly like a turn_on failure does below.
            _LOGGER.error(
                "Failed to persist runtime state for %s: %s; aborting before "
                "turn_on (the zone is NOT watering)",
                self.entry.entry_id,
                err,
            )
            self._is_watering = False
            self._started_at = None
            self._finishes_at = None
            self._active_duration = None
            self._active_source = None
            self._active_schedule_id = None
            self._active_ph_value = None
            self._active_ec_value = None
            self._active_ec_unit = None
            self._active_ph_value_2 = None
            self._active_ec_value_2 = None
            self._active_ec_unit_2 = None
            self._active_actuated = False
            self._active_run_uid = None
            return

        self._suppress_state_listener = True
        try:
            await self._async_call_target_service(True)
        except Exception as err:  # noqa: BLE001 - abort loudly, never fake a run
            _LOGGER.error(
                "Failed to turn on %s via %s.%s: %s; aborting watering run for "
                "%s (the zone is NOT watering)",
                self.target_entity_id,
                service_domain,
                turn_on_service,
                err,
                self.entry.entry_id,
            )
            # The abort path below does NOT send a turn_off (it assumes the
            # target never turned on), so turn it off DEFENSIVELY first: with
            # an async device the command may have partially taken effect.
            self._suppress_state_listener = True
            try:
                await self._async_call_target_service(False)
            except Exception:  # never block the abort path
                _LOGGER.exception(
                    "Failed to defensively turn off %s", self.target_entity_id
                )
            finally:
                self._suppress_state_listener = False
            # Surfaced on the card exactly like the pH gate's warning badge
            # (see _check_ph_gate) -- only for SCHEDULED runs, matching that
            # same convention: a manual water_now failure is immediately
            # visible to whoever just clicked it, no badge needed.
            if source == SOURCE_SCHEDULE and schedule_id is not None:
                self._schedule_warnings[schedule_id] = WARNING_TARGET_NEVER_ACTUATED
            await self._async_abort_run()
            return
        finally:
            self._suppress_state_listener = False

        # DEFERRED actuation check. Real devices (Z-Wave, Zigbee, MQTT,
        # motorized valves) are async: the service returns as soon as the
        # command is dispatched and the entity state catches up seconds later,
        # so checking right after turn_on would ALWAYS see "off". Give the
        # target ACTUATION_GRACE; if it still has not actuated by then the run
        # ends loudly and the target is turned off defensively. Registered
        # BEFORE the stop timer below: for a short duration (< grace) both
        # fire at the exact same instant, and equal-time callbacks run in
        # registration order -- this check must be the one to decide, so a
        # dead target is aborted loudly instead of silently completing
        # through the generic stop-timer path.
        grace = min(ACTUATION_GRACE, duration)
        self._unsub_actuation = async_track_point_in_time(
            self.hass,
            partial(
                self._async_actuation_check_fired,
                expected_run_id=run_id,
                grace=grace,
            ),
            now_utc + timedelta(seconds=grace),
        )

        # SAFETY NET: arm the stop timer IMMEDIATELY after the turn_on command,
        # before any verification. There must never be a window in which a
        # turn_on was sent without a timer that will turn the target off.
        self._unsub_stop = async_track_point_in_time(
            self.hass, self._async_stop_timer_fired, finishes_utc
        )

        _LOGGER.info(
            "Watering started for %s (source=%s, duration=%ss, finishes_at=%s)",
            self.entry.entry_id,
            source,
            duration,
            finishes_utc.isoformat(),
        )
        self._reschedule_next()
        self._async_dispatch_update()

    async def _async_finish_run(
        self,
        *,
        turn_off: bool,
        remove_state: bool,
        expected_run_id: int | None = None,
        log_history: bool = True,
    ) -> None:
        """Finish the active run: turn the target off and clear run state.

        ``log_history=False`` is for callers that KNOW the target never
        actually actuated (the deferred grace check, and a resumed run found
        not actuated on restart): no water was delivered, so it must not be
        recorded as a completed watering.

        ``expected_run_id`` (captured by the state-change listener when the
        event fired) rejects callbacks that race with or follow a different
        run generation. The in-memory run state is cleared BEFORE awaiting the
        turn_off so the echo of our own command (a separate task) cannot
        re-enter this method.
        """
        if not self._is_watering:
            return
        if expected_run_id is not None and expected_run_id != self._run_id:
            return

        self._cancel_stop()
        self._cancel_actuation()
        # Invalidate this run generation so stale callbacks are rejected.
        self._run_id += 1
        run_id = self._run_id
        self._is_watering = False
        # Captured for the history log below (ACTUAL finish time/duration,
        # not the originally scheduled one -- a run stopped early logs the
        # real elapsed time it watered).
        history_started_at = self._started_at
        history_finished_at = dt_util.utcnow()
        history_source = self._active_source
        history_schedule_id = self._active_schedule_id
        history_ph_value = self._active_ph_value
        history_ec_value = self._active_ec_value
        history_ec_unit = self._active_ec_unit
        history_ph_value_2 = self._active_ph_value_2
        history_ec_value_2 = self._active_ec_value_2
        history_ec_unit_2 = self._active_ec_unit_2
        # Whether the target ever actually left its off state during this
        # run: the STICKY flag (set by the actuation check or the live
        # listener) OR the current state right now, BEFORE we turn it off
        # below. The sticky flag is what makes this different from "is the
        # target actuated RIGHT NOW": a run ending (stop timer, manual stop,
        # or an EXTERNAL actor turning the target off) sees the target
        # already off by this point even though it genuinely watered, and
        # that must still be logged. A target that never actuated at all
        # (neither flag nor current state) must not be logged as a
        # completed watering, regardless of which path is ending it.
        history_actuated = self._active_actuated or self._async_target_is_actuated()
        history_run_uid = self._active_run_uid
        self._started_at = None
        self._finishes_at = None
        self._active_duration = None
        self._active_source = None
        self._active_schedule_id = None
        self._active_ph_value = None
        self._active_ec_value = None
        self._active_ec_unit = None
        self._active_ph_value_2 = None
        self._active_ec_value_2 = None
        self._active_ec_unit_2 = None
        self._active_actuated = False
        self._active_run_uid = None

        superseded = False
        if turn_off:
            off_confirmed = False
            for attempt in range(1, TURN_OFF_MAX_ATTEMPTS + 1):
                # A newer run may have started while we were retrying: never
                # turn off a target that a newer run is watering.
                if self._run_id != run_id:
                    _LOGGER.debug(
                        "A new watering run started while finishing %s; "
                        "keeping it",
                        self.entry.entry_id,
                    )
                    superseded = True
                    remove_state = False
                    break

                self._suppress_state_listener = True
                try:
                    await self._async_call_target_service(False)
                except Exception as err:  # noqa: BLE001 - retried below
                    _LOGGER.warning(
                        "Failed to turn off %s (attempt %d/%d): %s",
                        self.target_entity_id,
                        attempt,
                        TURN_OFF_MAX_ATTEMPTS,
                        err,
                    )
                finally:
                    self._suppress_state_listener = False

                # Confirm by the CURRENT entity state. With an async device the
                # echo of our own turn_off arrives later, so a dispatched
                # command only counts once the target actually reports off.
                if self._async_target_is_off():
                    off_confirmed = True
                    break

                if attempt < TURN_OFF_MAX_ATTEMPTS:
                    _LOGGER.debug(
                        "Target %s still not off after turn_off attempt "
                        "%d/%d; retrying in %ds for %s",
                        self.target_entity_id,
                        attempt,
                        TURN_OFF_MAX_ATTEMPTS,
                        TURN_OFF_RETRY_DELAY,
                        self.entry.entry_id,
                    )
                    await self._async_wait(TURN_OFF_RETRY_DELAY)

            if not off_confirmed and not superseded:
                # The target could not be confirmed off: KEEP the runtime store
                # entry -- it is the restart-recovery safety net that turns the
                # target off defensively after the next boot if it really is
                # still open.
                _LOGGER.error(
                    "Target %s is still not off after %d turn_off attempts; "
                    "keeping runtime state for %s so restart recovery can "
                    "turn it off defensively",
                    self.target_entity_id,
                    TURN_OFF_MAX_ATTEMPTS,
                    self.entry.entry_id,
                )
                remove_state = False
                # ...and keep trying in THIS session too, instead of leaving a
                # possibly-open target unwatched until the next boot.
                self._async_arm_shutdown_watchdog(history_run_uid)

        # A new run may have started while the old target command was in
        # flight. Its target/store must be left alone, but the immutable
        # snapshot captured above still needs history/accounting.
        if self._run_id != run_id:
            superseded = True
            remove_state = False

        will_log = log_history and history_actuated and history_started_at is not None
        if will_log:
            logged = await self._async_log_history(
                started_at=history_started_at,
                finished_at=history_finished_at,
                source=history_source,
                schedule_id=history_schedule_id,
                run_uid=history_run_uid,
                ph_value=history_ph_value,
                ec_value=history_ec_value,
                ec_unit=history_ec_unit,
                ph_value_2=history_ph_value_2,
                ec_value_2=history_ec_value_2,
                ec_unit_2=history_ec_unit_2,
            )
            if logged and not remove_state:
                await self._async_store_mark_history_logged(history_run_uid)
            if not logged:
                # Keep the persisted record as an accounting retry journal.
                # Recovery will retry the idempotent append on the next boot.
                remove_state = False
        if remove_state:
            # Conditional removal avoids deleting a newer run that started
            # while this run was finishing.
            await self.store.async_remove_entry(
                self.entry.entry_id, expected_run_uid=history_run_uid
            )

        _LOGGER.debug("Watering finished for %s", self.entry.entry_id)
        self._reschedule_next()
        self._async_dispatch_update()

    async def _async_store_mark_actuated(self, run_uid: str | None = None) -> None:
        """Persist that THIS run's target has been confirmed actuated.

        Called at every point the in-memory sticky ``_active_actuated`` flag
        turns True. A crash right after has no in-memory state to consult on
        the next boot, so this is the ONLY way restart recovery can tell a
        run that genuinely delivered water apart from one whose ``turn_on``
        never took effect before the crash. No-op if the store entry is
        already gone (run already finished normally) or already marked.

        Goes through ``store.async_update_entry`` (one atomic load-mutate-
        save under a single lock hold) rather than a separate load() +
        save_entry() -- the latter raced against
        ``_async_store_mark_history_logged`` for the SAME entry_id: each
        held its own stale local snapshot from an earlier, independently
        locked load(), so whichever saved last silently clobbered the
        other's field (reproduced with a forced interleaving before this
        fix).

        ``run_uid`` is captured by the caller at the moment the actuation was
        OBSERVED and makes the write a no-op if the record changed hands in
        the meantime. Without it, a callback that waited on the Store lock
        while its own run ended could stamp ``actuated=True`` on the NEXT
        run's record -- and after a crash, restart recovery would then count a
        run that may never have opened the target as real delivered water.
        """

        def _mutate(run_state: dict[str, Any] | None) -> dict[str, Any] | None:
            if run_state is None or run_state.get("actuated"):
                return None
            if run_uid is not None and run_state.get("run_uid") != run_uid:
                return None
            run_state["actuated"] = True
            return run_state

        await self.store.async_update_entry(self.entry.entry_id, _mutate)

    async def _async_store_mark_history_logged(self, run_uid: str | None = None) -> None:
        """Persist that this run's history entry (and reservoir deduction,
        which _async_log_history always performs together with it) has
        already been recorded.

        Called from _async_finish_run right before logging, but ONLY when
        the store entry is about to survive (turn_off could not be
        confirmed). Without this, _async_recover_state's downtime-expired
        branch has no way to know the surviving record was already logged
        and would log the SAME physical run again on the next restart. See
        _async_store_mark_actuated for why this goes through the atomic
        ``async_update_entry`` instead of a separate load()/save_entry().
        """

        def _mutate(run_state: dict[str, Any] | None) -> dict[str, Any] | None:
            if run_state is None or (
                run_uid is not None and run_state.get("run_uid") != run_uid
            ):
                return None
            run_state["history_logged"] = True
            return run_state

        await self.store.async_update_entry(self.entry.entry_id, _mutate)

    async def _async_log_history(
        self,
        *,
        started_at: datetime,
        finished_at: datetime,
        source: str | None,
        schedule_id: str | None,
        ph_value: float | None = None,
        ec_value: float | None = None,
        ec_unit: str | None = None,
        ph_value_2: float | None = None,
        ec_value_2: float | None = None,
        ec_unit_2: str | None = None,
        run_uid: str | None = None,
    ) -> bool:
        """Append a completed run to the history log.

        Best-effort: a storage hiccup here must never fail the run-finish
        path (history is informational, not safety-critical). Snapshots
        ``flow_rate_lph``/``number_of_pots`` AT FINISH TIME (accurate volume
        even if those settings change later) and ``ph_value``/``ec_value``/
        ``ec_unit`` (plus their R2 counterparts) AS PASSED IN -- callers
        snapshot those at the moment they matter (run START for the normal
        path; whatever was persisted for a recovered run), not read fresh
        here.
        """
        duration = max(0, int((finished_at - started_at).total_seconds()))
        record = {
            "run_uid": run_uid,
            "started_at": started_at.isoformat(),
            "finishes_at": finished_at.isoformat(),
            "duration": duration,
            "source": source,
            "schedule_id": schedule_id,
            "flow_rate_lph": self.flow_rate_lph,
            "number_of_pots": self.number_of_pots,
            "ph_value": ph_value,
            "ec_value": ec_value,
            "ec_unit": ec_unit,
            "ph_value_2": ph_value_2,
            "ec_value_2": ec_value_2,
            "ec_unit_2": ec_unit_2,
        }
        try:
            # The append is idempotent by run_uid, but whether THIS call
            # inserted the record or found it already there does not change
            # what the caller needs to know -- both mean "this run is in
            # history". The reservoir deduction below is deduped
            # independently, by the accounted-runs journal, deliberately NOT
            # by this flag: a crash between a successful append and the
            # deduction must still be able to deduct on the retry.
            self._history, _inserted = await self.store.async_append_history(
                self.entry.entry_id,
                record,
                max_age_days=HISTORY_RETENTION_DAYS,
                max_entries=HISTORY_MAX_ENTRIES,
            )
        except Exception:  # informational, never fatal
            _LOGGER.exception(
                "Failed to append watering history for %s", self.entry.entry_id
            )
            return False

        # Deduct the water this run ACTUALLY delivered from the tracked
        # reservoir level. flow_rate_lph is L/h PER POT (see its docstring),
        # so total liters = (L/h per pot / 3600) * seconds * pots. This
        # method only ever gets called for a CONFIRMED-delivered run (see
        # history_actuated in _async_finish_run and this method's other
        # caller in the downtime-expired recovery path), so no separate
        # "did it really water" check is needed here -- reuses that same
        # fail-safe gate. number_of_pots == 0 means "not configured", not
        # "zero pots" (same convention as the card's totalVolumeMl in
        # utils.ts): treated as 1 pot here too, or a zone that never set it
        # would show a nonzero volume per run in its history (computed by
        # the frontend with that same fallback) while the tracked reservoir
        # level never moved.
        pots = self.number_of_pots if self.number_of_pots > 0 else 1
        total_liters = (self.flow_rate_lph / 3600) * duration * pots
        self._deduct_reservoir_volume(total_liters, run_uid)
        return True

    async def _async_abort_run(self) -> None:
        """Abort a run whose target could not be actuated (fail loudly)."""
        # Captured before the state is torn down below: the watchdog armed at
        # the end of this method needs to know WHICH run's record it is
        # watching (see _async_watchdog_owns_record).
        aborted_run_uid = self._active_run_uid
        self._cancel_stop()
        self._cancel_actuation()
        self._run_id += 1
        self._is_watering = False
        self._started_at = None
        self._finishes_at = None
        self._active_duration = None
        self._active_source = None
        self._active_schedule_id = None
        self._active_ph_value = None
        self._active_ec_value = None
        self._active_ec_unit = None
        self._active_ph_value_2 = None
        self._active_ec_value_2 = None
        self._active_ec_unit_2 = None
        self._active_actuated = False
        self._active_run_uid = None
        if self._async_target_is_off():
            await self.store.async_remove_entry(self.entry.entry_id)
        else:
            # The defensive turn_off issued by the caller could not be
            # confirmed: KEEP the runtime store entry so restart recovery
            # retries turning the target off, consistent with
            # _async_finish_run's off-confirmation policy (never discard the
            # recovery record for a target that might still be open).
            _LOGGER.error(
                "Target %s could not be confirmed off after aborting; "
                "keeping runtime state for %s so restart recovery can turn "
                "it off defensively",
                self.target_entity_id,
                self.entry.entry_id,
            )
            # ...and keep trying in THIS session too (see
            # _async_arm_shutdown_watchdog).
            self._async_arm_shutdown_watchdog(aborted_run_uid)
        self._reschedule_next()
        self._async_dispatch_update()

    async def _async_stop_timer_fired(self, *_: Any) -> None:
        """Stop timer fired: end the run."""
        await self._async_finish_run(turn_off=True, remove_state=True)

    async def _async_actuation_check_fired(
        self,
        *_: Any,
        expected_run_id: int,
        grace: int,
    ) -> None:
        """Actuation grace elapsed: verify the target actually left its off state.

        Runs ``grace`` seconds after the turn_on command. A real (async) device
        may need seconds to report its new state, so the run is never aborted
        on an immediate check; if the target STILL reports an off state now,
        the run ends loudly and the target is turned off defensively (never
        leave the valve open with no timer to close it).
        """
        if not self._is_watering or expected_run_id != self._run_id:
            return
        if self._async_target_is_actuated():
            self._active_actuated = True
            await self._async_store_mark_actuated(self._active_run_uid)
            return

        service_domain, turn_on_service, _ = resolve_target_services(
            self.target_domain
        )
        _LOGGER.error(
            "Target %s is still in an off state %ss after %s.%s; aborting "
            "watering run for %s (the zone is NOT watering)",
            self.target_entity_id,
            grace,
            service_domain,
            turn_on_service,
            self.entry.entry_id,
        )
        # Surfaced on the card exactly like the pH gate's warning badge --
        # captured BEFORE _async_finish_run clears _active_source/
        # _active_schedule_id below. Only for SCHEDULED runs (manual
        # water_now failures are immediately visible to whoever clicked it).
        if self._active_source == SOURCE_SCHEDULE and self._active_schedule_id is not None:
            self._schedule_warnings[self._active_schedule_id] = (
                WARNING_TARGET_NEVER_ACTUATED
            )
        # Let _async_finish_run own the turn_off: it retries with confirmation
        # and, if the target still cannot be confirmed off, PRESERVES the
        # runtime store entry so restart recovery keeps trying defensively. A
        # single fire-and-forget attempt here would leave nothing watching a
        # target that only actuates AFTER this point (e.g. a slow mesh device
        # retrying its own route) -- the valve would stay open with no timer,
        # no store entry and no listener ever reacting again.
        await self._async_finish_run(
            turn_off=True,
            remove_state=True,
            expected_run_id=expected_run_id,
            log_history=False,  # never actuated: no water was delivered
        )

    async def _async_schedule_fired(self, *_: Any) -> None:
        """The scheduled next-run timer fired.

        Only SCHEDULED firings are gated by pH (a manual ``water_now`` is
        always an explicit override and bypasses it, per design). The body
        runs inside ``try/finally``: this timer is one-shot, so if anything
        here raised without ``_reschedule_next()`` running afterwards the
        zone would silently stop scheduling until restart or an options
        change. ``schedules`` already filters out a corrupt ``duration``
        before it ever reaches ``_next_schedule`` -- this is defense in depth
        for any OTHER unexpected exception in this method.
        """
        try:
            if self._is_watering:
                _LOGGER.debug(
                    "Scheduled start ignored for %s: already watering",
                    self.entry.entry_id,
                )
            else:
                schedule = self._next_schedule
                if schedule is None:
                    _LOGGER.debug(
                        "Scheduled start fired for %s but no matching schedule found",
                        self.entry.entry_id,
                    )
                else:
                    schedule_id = schedule.get(CONF_SCHEDULE_ID)
                    allowed, reason = self._check_ph_gate()
                    if not allowed:
                        _LOGGER.warning(
                            "Skipping scheduled watering for %s (schedule %s): %s",
                            self.entry.entry_id,
                            schedule_id,
                            reason,
                        )
                        if schedule_id is not None:
                            self._schedule_warnings[schedule_id] = (
                                reason or "pH fora do intervalo configurado"
                            )
                        self._async_dispatch_update()
                    else:
                        await self._async_start_run(
                            duration=int(schedule[CONF_SCHEDULE_DURATION]),
                            source=SOURCE_SCHEDULE,
                            schedule_id=schedule_id,
                        )
        finally:
            self._reschedule_next()

    def _check_ph_gate(self) -> tuple[bool, str | None]:
        """Whether the pH gate allows a scheduled run to start right now.

        Checks the R1 reservoir, then (if configured) the independent R2
        reservoir -- a single target/pump can draw from two physically
        distinct reservoirs. Returns ``(True, None)`` only if EVERY
        configured reservoir passes; the first one that fails (missing,
        unavailable, unparseable, or out of its own range) blocks the run,
        with the reason naming which reservoir when both are in play.
        """
        label_2 = "R2: " if self.ph_entity_id_2 else ""
        allowed, reason = self._check_ph_range(
            self.ph_entity_id, self.ph_min, self.ph_max, label="R1: " if label_2 else ""
        )
        if not allowed:
            return False, reason
        if not self.ph_entity_id_2:
            return True, None
        return self._check_ph_range(
            self.ph_entity_id_2, self.ph_min_2, self.ph_max_2, label=label_2
        )

    def _check_ph_range(
        self, entity_id: str, ph_min: float, ph_max: float, *, label: str = ""
    ) -> tuple[bool, str | None]:
        """Whether a single pH sensor reads inside ``[ph_min, ph_max]``.

        Returns ``(True, None)`` when ``entity_id`` is empty (that reservoir
        is not configured) or the reading is within range. Returns
        ``(False, reason)`` when the sensor is missing/unavailable/
        unparseable (fail-safe: never water on an unknown pH) or out of
        range. ``label`` is prefixed to the reason (e.g. ``"R2: "``) only
        when the caller needs to disambiguate between two reservoirs.
        """
        if not entity_id:
            return True, None

        state = self.hass.states.get(entity_id)
        if state is None or state.state in ("unknown", "unavailable"):
            return False, f"{label}Sensor de pH {entity_id} indisponível"

        try:
            value = float(state.state)
        except (TypeError, ValueError):
            return False, (
                f"{label}Sensor de pH {entity_id} com valor inválido ({state.state!r})"
            )
        if not math.isfinite(value):
            # float("nan") raises NOTHING, and nan compares False against both
            # < and > -- without this check a NaN reading would silently fall
            # through both range comparisons below and the gate would ALLOW
            # the run, exactly the "watering blindly" outcome fail-safe is
            # supposed to prevent.
            return False, (
                f"{label}Sensor de pH {entity_id} com valor inválido ({state.state!r})"
            )

        if value < ph_min:
            return False, f"{label}pH {value:g} abaixo do mínimo ({ph_min:g})"
        if value > ph_max:
            return False, f"{label}pH {value:g} acima do máximo ({ph_max:g})"
        return True, None

    def _read_sensor_value(self, entity_id: str) -> float | None:
        """Best-effort current numeric reading of a configured sensor.

        Returns ``None`` when ``entity_id`` is empty (not configured) or the
        state is missing/unavailable/unparseable/non-finite -- used to
        snapshot pH/EC at run start for the history log, where an unknown
        reading should just be recorded as unknown, not block anything.
        """
        if not entity_id:
            return None
        state = self.hass.states.get(entity_id)
        if state is None:
            return None
        try:
            value = float(state.state)
        except (TypeError, ValueError):
            return None
        return value if math.isfinite(value) else None

    def _read_sensor_unit(self, entity_id: str) -> str | None:
        """``unit_of_measurement`` of a configured sensor, or None.

        Only EC needs this snapshotted (µS/cm vs mS/cm vary by sensor); pH
        always displays with a fixed "PH" suffix regardless of the sensor's
        own unit (see ``ph_entity_id``'s docstring), so it has no equivalent.
        """
        if not entity_id:
            return None
        state = self.hass.states.get(entity_id)
        if state is None:
            return None
        unit = state.attributes.get("unit_of_measurement")
        return unit if isinstance(unit, str) else None

    async def _async_target_state_changed(self, event: Event) -> None:
        """React to the target entity changing state, on OR off, at ANY time.

        Registered unconditionally in ``async_setup`` (not just while
        watering): a target actuated OUTSIDE the integration -- a physical
        button, the device's own app, another automation -- while we are
        NOT tracking a run is handed off to
        ``_async_maybe_start_external_run`` instead of being ignored.
        """
        if self._suppress_state_listener:
            return
        if not self._is_watering:
            if self._watchdog_active:
                # A preserved record is still waiting for a confirmed
                # shutdown; that takes precedence over reading a still-on
                # target as a brand-new external activation (which
                # async_create_entry would refuse anyway).
                await self._async_watchdog_state_changed()
                return
            await self._async_maybe_start_external_run()
            return
        run_id = self._run_id
        # Decide by the CURRENT entity state, never by the ``new_state``
        # snapshot carried in the event. With an async device the echo of our
        # own turn_off can arrive AFTER a newer run started: the event payload
        # is a stale picture from when it fired, while the state machine may
        # already reflect the newer run (target ON). Trusting the event would
        # kill the newer run and leave the valve open with no timer.
        current = self.hass.states.get(self.target_entity_id)
        if current is not None and current.state not in off_states(self.target_domain):
            # The target reporting itself actuated is authoritative proof
            # water was (or is being) delivered -- record it regardless of
            # the grace window below, so a LEGITIMATE external stop later
            # (target now off, but it really did water) still gets logged to
            # history in _async_finish_run instead of being confused with a
            # target that never actuated at all.
            self._active_actuated = True
            await self._async_store_mark_actuated(self._active_run_uid)
            return
        if current is None or current.state not in confirmed_off_states(
            self.target_domain
        ):
            # unavailable/unknown (or the entity missing from the state
            # machine entirely) is NOT proof the target is truly off -- the
            # comment in confirmed_off_states applies here just as much as
            # everywhere else it is used. Treating it as a confirmed stop
            # would finish the run with turn_off=False (no turn_off even
            # attempted) and discard the recovery record unconditionally.
            # Ignore the event instead: the regularly scheduled stop timer
            # (turn_off=True, with its own retry+confirmation and store
            # retention) still ends the run safely at finishes_at.
            return
        # During the actuation grace window the DEFERRED actuation check
        # decides whether the run is healthy; an "off" event here is almost
        # always the stale echo of a previous run's turn_off (or our own
        # turn_on that an async device has not applied yet). Acting on it
        # would kill the new run AND cancel its stop timer + actuation check,
        # leaving the valve possibly open with no safety net. Only once the
        # grace has elapsed does an "off" mean a legitimate external stop.
        grace = (
            min(ACTUATION_GRACE, self._active_duration)
            if self._active_duration is not None
            else 0
        )
        if self._active_source != SOURCE_EXTERNAL and self._started_at is not None and dt_util.utcnow() < self._started_at + timedelta(
            seconds=grace
        ):
            return
        _LOGGER.info(
            "Target %s is %s while watering; stopping run for %s",
            self.target_entity_id,
            current.state if current is not None else "unknown",
            self.entry.entry_id,
        )
        # Surfaced on the card exactly like the pH gate's warning badge --
        # captured BEFORE _async_finish_run clears _active_source/
        # _active_schedule_id below. Ambiguous between a genuine power/
        # connectivity loss and an intentional external stop (another
        # automation, manual override) -- there is no way to tell them apart
        # from the entity's confirmed-off state alone, so both surface the
        # same warning. Only for SCHEDULED runs, matching the pH gate's own
        # manual-water_now exclusion.
        if self._active_source == SOURCE_SCHEDULE and self._active_schedule_id is not None:
            self._schedule_warnings[self._active_schedule_id] = (
                WARNING_TARGET_STOPPED_EARLY
            )
        await self._async_finish_run(
            turn_off=False, remove_state=True, expected_run_id=run_id
        )

    async def _async_maybe_start_external_run(self) -> None:
        """Check whether the target was just actuated OUTSIDE the
        integration -- a physical button, the device's own app, another
        automation -- while we are not tracking any run, and if so, start
        tracking it (see ``_async_start_external_run``).

        Ignores anything that is not a genuine actuated state right now:
        ``off``/``closed`` (nothing happened), and ``unavailable``/
        ``unknown``/entity-missing (not proof of anything, same fail-safe
        reasoning as everywhere else ``off_states`` is used).
        """
        current = self.hass.states.get(self.target_entity_id)
        if current is None or current.state in off_states(self.target_domain):
            return
        await self._async_start_external_run()

    async def _async_start_external_run(self) -> None:
        """Track a run that was started OUTSIDE the integration.

        The target is already confirmed actuated -- that is literally what
        triggered this -- so this skips the ``turn_on`` service call and the
        deferred actuation-grace check that ``_async_start_run`` needs for a
        command it just issued itself. Everything else goes through the
        SAME lifecycle as any other run: Store persistence, a stop timer
        (the safety net -- there is no way to know how long the person who
        flipped it intended it to stay on, so it gets the zone's
        ``default_duration``, exactly like a ``water_now`` with no explicit
        duration), the live "watering" indicator, and history/reservoir
        accounting when it ends via the normal ``_async_finish_run``/
        ``_async_target_state_changed`` paths.

        The pH gate does NOT apply here: it only gates a decision this
        integration is about to make, and by the time this runs the target
        is already on -- there is nothing left to block.
        """
        if self._is_watering:
            return

        duration = max(MIN_DURATION, min(self.default_duration, self.max_duration))
        now_utc = dt_util.utcnow()
        finishes_utc = now_utc + timedelta(seconds=duration)
        run_uid = uuid.uuid4().hex

        self._run_id += 1
        self._is_watering = True
        self._started_at = now_utc
        self._finishes_at = finishes_utc
        self._active_duration = duration
        self._active_source = SOURCE_EXTERNAL
        self._active_schedule_id = None
        self._active_ph_value = self._read_sensor_value(self.ph_entity_id)
        self._active_ec_value = self._read_sensor_value(self.ec_entity_id)
        self._active_ec_unit = self._read_sensor_unit(self.ec_entity_id)
        self._active_ph_value_2 = self._read_sensor_value(self.ph_entity_id_2)
        self._active_ec_value_2 = self._read_sensor_value(self.ec_entity_id_2)
        self._active_ec_unit_2 = self._read_sensor_unit(self.ec_entity_id_2)
        # Actuation is not a hypothesis to verify here -- it is literally
        # what triggered this method -- so both the in-memory sticky flag
        # and its persisted mirror start out already True, unlike
        # _async_start_run (which starts False and waits for the deferred
        # actuation check to confirm the turn_on it just issued).
        self._active_actuated = True
        self._active_run_uid = run_uid

        # Arm the physical safety net before persistence. A disk failure must
        # degrade durability, never remove the only timer that closes water.
        self._unsub_stop = async_track_point_in_time(
            self.hass, self._async_stop_timer_fired, finishes_utc
        )

        created = True
        try:
            created = await self.store.async_create_entry(
                self.entry.entry_id,
                {
                    "started_at": now_utc.isoformat(),
                    "finishes_at": finishes_utc.isoformat(),
                    "duration": duration,
                    "source": SOURCE_EXTERNAL,
                    "schedule_id": None,
                    "ph_value": self._active_ph_value,
                    "ec_value": self._active_ec_value,
                    "ec_unit": self._active_ec_unit,
                    "ph_value_2": self._active_ph_value_2,
                    "ec_value_2": self._active_ec_value_2,
                    "ec_unit_2": self._active_ec_unit_2,
                    "actuated": True,
                    "run_uid": run_uid,
                },
            )
        except Exception as err:  # noqa: BLE001 - revert, never leave the zone stuck
            _LOGGER.error(
                "Failed to persist runtime state for an externally-activated "
                "run on %s: %s; continuing with the in-memory safety timer",
                self.entry.entry_id,
                err,
            )
        if not created:
            # A pending recovery record won the Store race. Never overwrite
            # its run_uid/source/timestamps with a freshly inferred external
            # run. Its recovery path remains authoritative.
            self._cancel_stop()
            self._is_watering = False
            self._started_at = None
            self._finishes_at = None
            self._active_duration = None
            self._active_source = None
            self._active_schedule_id = None
            self._active_ph_value = None
            self._active_ec_value = None
            self._active_ec_unit = None
            self._active_ph_value_2 = None
            self._active_ec_value_2 = None
            self._active_ec_unit_2 = None
            self._active_actuated = False
            self._active_run_uid = None
            _LOGGER.warning(
                "Ignoring external activation reconciliation for %s because "
                "a pending recovery record already exists",
                self.entry.entry_id,
            )
            return
        _LOGGER.info(
            "External activation detected for %s; tracking as a run "
            "(source=%s, duration=%ss, finishes_at=%s)",
            self.entry.entry_id,
            SOURCE_EXTERNAL,
            duration,
            finishes_utc.isoformat(),
        )
        self._reschedule_next()
        self._async_dispatch_update()

    # ------------------------------------------------------------------
    # Next-run scheduling
    # ------------------------------------------------------------------
    def _reschedule_next(self) -> None:
        """Cancel any pending next-run timer and schedule a fresh one."""
        self._cancel_next()
        now = dt_util.now()
        self._next_run, self._next_schedule = find_next_run(
            self.schedules, now, enabled=self.enabled
        )
        if self._next_run is not None:
            self._unsub_next = async_track_point_in_time(
                self.hass, self._async_schedule_fired, self._next_run
            )

    def _cancel_next(self) -> None:
        if self._unsub_next is not None:
            self._unsub_next()
            self._unsub_next = None
        self._next_run = None
        self._next_schedule = None

    def _cancel_stop(self) -> None:
        if self._unsub_stop is not None:
            self._unsub_stop()
            self._unsub_stop = None

    def _cancel_actuation(self) -> None:
        if self._unsub_actuation is not None:
            self._unsub_actuation()
            self._unsub_actuation = None

    def _cancel_watchdog(self) -> None:
        if self._unsub_watchdog is not None:
            self._unsub_watchdog()
            self._unsub_watchdog = None

    # ------------------------------------------------------------------
    # Shutdown watchdog (target preserved as possibly-open)
    # ------------------------------------------------------------------
    def _async_arm_shutdown_watchdog(self, run_uid: str | None = None) -> None:
        """Watch a target that could not be CONFIRMED off, in THIS session.

        Called from every path that preserves the runtime store record because
        the target might still be open (restart recovery's defensive turn_off,
        the turn_off retry loop in _async_finish_run, and _async_abort_run).
        Keeping the record makes the NEXT boot retry; this makes the CURRENT
        session retry too, instead of leaving a possibly-open valve with no
        timer, no listener action and nothing else watching it until Home
        Assistant happens to restart.

        ``run_uid`` is the run the record belongs to. It is remembered so every
        late action this watchdog takes can first check it still OWNS that
        record (see _async_watchdog_owns_record); ``None`` is a legacy record
        with no uid, which by the same check can never match a newer run (those
        always persist one).

        Refuses to arm once ``async_unload`` started: an async_call_later is
        not bound to the config entry, so a timer armed while tearing down
        outlives this object and fires against the reloaded instance.
        """
        if self._unloaded:
            _LOGGER.debug(
                "Not arming the shutdown watchdog for %s: the scheduler is "
                "being unloaded (the record stays for the next setup)",
                self.entry.entry_id,
            )
            return
        self._watchdog_active = True
        # Only the arming callers pass a uid; the re-arm between backoff steps
        # passes nothing and must keep the one it is already watching
        # (_async_clear_shutdown_watchdog resets it back to None).
        if run_uid is not None:
            self._watchdog_run_uid = run_uid
        self._cancel_watchdog()
        index = min(self._watchdog_attempt, len(SHUTDOWN_WATCHDOG_DELAYS) - 1)
        delay = SHUTDOWN_WATCHDOG_DELAYS[index]
        _LOGGER.debug(
            "Shutdown watchdog armed for %s: retrying turn_off of %s in %ss "
            "(attempt %d/%d)",
            self.entry.entry_id,
            self.target_entity_id,
            delay,
            self._watchdog_attempt + 1,
            len(SHUTDOWN_WATCHDOG_DELAYS),
        )
        self._unsub_watchdog = async_call_later(
            self.hass, delay, self._async_watchdog_fired
        )

    def _async_clear_shutdown_watchdog(self) -> None:
        """Stop watching: the record is settled, superseded or given up on."""
        self._cancel_watchdog()
        self._watchdog_active = False
        self._watchdog_attempt = 0
        self._watchdog_run_uid = None

    async def _async_watchdog_owns_record(self) -> bool:
        """Whether the stored record is still the run this watchdog watches.

        A watchdog only ever acts on ITS OWN run: it turns a target off and
        settles a Store record on behalf of one specific ``run_uid``, and both
        of those are destructive if the record changed hands in the meantime
        (a reload creating a new scheduler, or a new run claiming the entry).
        The uid is compared against the CURRENT record rather than assumed, so
        the answer stays right no matter how late the callback fires. A record
        that vanished is not owned either -- somebody already settled it.
        """
        data = await self.store.async_load()
        run_state = data["entries"].get(self.entry.entry_id)
        if not run_state:
            return False
        return run_state.get("run_uid") == self._watchdog_run_uid

    async def _async_watchdog_fired(self, *_: Any) -> None:
        """A backoff step elapsed: retry the defensive shutdown."""
        self._unsub_watchdog = None
        if not self._watchdog_active:
            return
        if self._is_watering:
            # A newer run owns the target now and has its own stop timer.
            self._async_clear_shutdown_watchdog()
            return
        if self._watchdog_attempt >= len(SHUTDOWN_WATCHDOG_DELAYS):
            _LOGGER.error(
                "Target %s could not be confirmed off after %d in-session "
                "retries; giving up for now and keeping runtime state so the "
                "next boot retries for %s",
                self.target_entity_id,
                self._watchdog_attempt,
                self.entry.entry_id,
            )
            self._async_clear_shutdown_watchdog()
            return
        self._watchdog_attempt += 1
        await self._async_attempt_pending_shutdown()

    async def _async_attempt_pending_shutdown(self) -> bool:
        """One defensive turn_off of a target left possibly open.

        Returns True when the target is CONFIRMED off afterwards (and the
        preserved record was settled), False when it must stay pending -- in
        which case the next backoff step is armed.
        """
        if self._is_watering:
            self._async_clear_shutdown_watchdog()
            return True
        if not await self._async_watchdog_owns_record():
            # The record changed hands (a reload's new scheduler, or a new run
            # claiming the entry) or was already settled. Actuating now would
            # close a target somebody else is legitimately watering, and
            # settling below would eat THEIR history and reservoir accounting.
            _LOGGER.debug(
                "Shutdown watchdog for %s stands down: the runtime record is "
                "no longer the run it was watching",
                self.entry.entry_id,
            )
            self._async_clear_shutdown_watchdog()
            return True

        self._suppress_state_listener = True
        try:
            await self._async_call_target_service(False)
        except Exception:  # retried on the next backoff step
            _LOGGER.exception(
                "Watchdog turn_off of %s failed", self.target_entity_id
            )
        finally:
            self._suppress_state_listener = False

        if not self._async_target_is_off():
            self._async_arm_shutdown_watchdog()
            return False

        _LOGGER.info(
            "Target %s is finally confirmed off; settling the preserved "
            "runtime record for %s",
            self.target_entity_id,
            self.entry.entry_id,
        )
        await self._async_resolve_pending_record()
        self._async_clear_shutdown_watchdog()
        self._async_dispatch_update()
        return True

    async def _async_watchdog_state_changed(self) -> None:
        """The target reported a new state while a record is pending.

        Only a CONFIRMED off is acted on here: it settles the record early,
        without waiting for the next backoff step. An ``on`` report is left to
        the timer on purpose -- retrying straight from the listener would loop
        tightly against the echo of our own turn_off on a device that never
        actually closes.
        """
        if not self._async_target_is_off():
            return
        if not await self._async_watchdog_owns_record():
            self._async_clear_shutdown_watchdog()
            return
        _LOGGER.info(
            "Target %s reported itself off; settling the preserved runtime "
            "record for %s",
            self.target_entity_id,
            self.entry.entry_id,
        )
        await self._async_resolve_pending_record()
        self._async_clear_shutdown_watchdog()
        self._async_dispatch_update()

    async def _async_resolve_pending_record(self) -> None:
        """Log (if owed) and drop the preserved runtime record for this entry.

        Reads the record from the Store rather than from a snapshot so the
        ``actuated``/``history_logged`` markers are always the current ones:
        _async_finish_run marks a surviving record as already logged, while a
        record preserved by restart recovery has not been logged yet. Same
        rules as the recovery path -- log only a run with persisted evidence
        it really actuated and that was not logged before, and only drop the
        record once that logging succeeded (otherwise it stays as the
        accounting retry journal).
        """
        data = await self.store.async_load()
        run_state = data["entries"].get(self.entry.entry_id)
        if not run_state:
            return
        if run_state.get("run_uid") != self._watchdog_run_uid:
            # Not ours to settle. Logging it would attribute another run's
            # water to this one and drop the journal it still needs.
            _LOGGER.debug(
                "Not settling the runtime record of %s: it belongs to a "
                "different run than the one being resolved",
                self.entry.entry_id,
            )
            return
        logged = True
        if run_state.get("actuated") and not run_state.get("history_logged"):
            logged = await self._async_log_recovered_run(run_state)
        if logged:
            await self.store.async_remove_entry(
                self.entry.entry_id, expected_run_uid=run_state.get("run_uid")
            )

    async def _async_log_recovered_run(self, run_state: dict[str, Any]) -> bool:
        """Append a stored (not in-memory) run record to history.

        Best-effort duration/start reconstruction from the persisted payload,
        exactly like the restart-recovery path it was extracted from: a
        hand-edited/corrupted store may hold a naive datetime, which must be
        normalized before it reaches _coerce_stored_duration or
        _async_log_history (both subtract it from an aware datetime, and
        naive - aware raises TypeError).
        """
        finishes_at = dt_util.parse_datetime(run_state.get("finishes_at") or "")
        if finishes_at is None:
            return True
        finishes_at = dt_util.as_utc(finishes_at)
        started_at = dt_util.parse_datetime(run_state.get("started_at") or "")
        if started_at is not None:
            started_at = dt_util.as_utc(started_at)
        duration = self._coerce_stored_duration(
            run_state.get("duration"), started_at, finishes_at
        )
        return await self._async_log_history(
            started_at=started_at or (finishes_at - timedelta(seconds=duration)),
            finished_at=finishes_at,
            source=run_state.get("source"),
            schedule_id=run_state.get("schedule_id"),
            run_uid=run_state.get("run_uid"),
            ph_value=run_state.get("ph_value"),
            ec_value=run_state.get("ec_value"),
            ec_unit=run_state.get("ec_unit"),
            ph_value_2=run_state.get("ph_value_2"),
            ec_value_2=run_state.get("ec_value_2"),
            ec_unit_2=run_state.get("ec_unit_2"),
        )

    # ------------------------------------------------------------------
    # Restart recovery
    # ------------------------------------------------------------------
    async def _async_recover_state(self) -> bool:
        """Resume an interrupted run or turn it off; return pending-record state."""
        data = await self.store.async_load()
        run_state = data["entries"].get(self.entry.entry_id)
        if not run_state:
            return False

        finishes_at = dt_util.parse_datetime(run_state.get("finishes_at"))
        if finishes_at is None:
            _LOGGER.warning(
                "Invalid finishes_at in runtime store for %s; discarding",
                self.entry.entry_id,
            )
            await self.store.async_remove_entry(self.entry.entry_id)
            return False
        # Normalize a naive datetime (hand-edited/corrupted store; every
        # writer here persists aware UTC) before comparing against
        # dt_util.utcnow() -- naive < aware raises TypeError.
        finishes_at = dt_util.as_utc(finishes_at)

        if finishes_at <= dt_util.utcnow():
            _LOGGER.warning(
                "Run for %s finished during downtime; turning %s off defensively",
                self.entry.entry_id,
                self.target_entity_id,
            )
            self._suppress_state_listener = True
            try:
                await self._async_call_target_service(False)
            except Exception:  # never block startup
                _LOGGER.exception(
                    "Failed to defensively turn off %s",
                    self.target_entity_id,
                )
            finally:
                self._suppress_state_listener = False
            # Only discard the runtime state once the target is CONFIRMED off.
            # If the defensive turn_off failed (e.g. the device is unavailable
            # right after boot) the store entry must survive: it is the
            # recovery record that makes the NEXT boot try again. Removing it
            # here would leave the valve open with no one to close it.
            if self._async_target_is_off():
                # It ran its course during downtime: log it as a completed
                # run (best-effort duration/start from the stored payload) --
                # but ONLY when there is persisted evidence the target was
                # actually confirmed actuated (``actuated``, set by
                # _async_store_mark_actuated at the same points the in-memory
                # sticky flag is set) AND it was not already logged by
                # _async_finish_run before this record survived a failed
                # turn_off (``history_logged``). Without both checks a run
                # that crashed before turn_on ever took effect would be
                # logged as a phantom completed watering, and a run that DID
                # already get logged (turn_off just could not be confirmed)
                # would be logged AGAIN here, double-counting a single
                # physical run in history and in the reservoir deduction.
                logged = True
                if run_state.get("actuated") and not run_state.get("history_logged"):
                    logged = await self._async_log_recovered_run(run_state)
                if logged:
                    await self.store.async_remove_entry(
                        self.entry.entry_id,
                        expected_run_uid=run_state.get("run_uid"),
                    )
            else:
                _LOGGER.error(
                    "Defensive turn_off of %s failed; keeping runtime state "
                    "so the next boot retries for %s",
                    self.target_entity_id,
                    self.entry.entry_id,
                )
                # Do not wait for that next boot to be the only retry: watch
                # the target for the rest of THIS session too. The usual cause
                # is a device still reporting ``unavailable`` seconds after
                # startup, which the first (short) backoff step catches.
                self._async_arm_shutdown_watchdog(run_state.get("run_uid"))
                return True
            return False

        # Resume: keep the run state and re-arm the stop timer. The stop
        # timer is armed against ``finishes_at`` (already validated above),
        # never against ``duration`` -- a corrupt started_at/duration in the
        # store can therefore never leave the target on longer than
        # intended; they only feed display/informational state, so a
        # malformed payload must degrade gracefully instead of crashing
        # ``async_setup_entry`` for the whole zone (a bare ``int(...)`` cast
        # used to raise here on a non-numeric duration).
        started_at = dt_util.parse_datetime(run_state.get("started_at"))
        if started_at is None and run_state.get("started_at") is not None:
            _LOGGER.warning(
                "Invalid started_at in runtime store for %s; resuming without it",
                self.entry.entry_id,
            )
        elif started_at is not None:
            # Normalize a naive value (hand-edited/corrupted store) before it
            # reaches _coerce_stored_duration or _async_log_history at finish
            # time, both of which subtract it from an aware datetime --
            # naive - aware raises TypeError and would crash the whole zone's
            # setup (via _coerce_stored_duration below) or silently drop the
            # eventual history entry.
            started_at = dt_util.as_utc(started_at)
        self._run_id += 1
        self._is_watering = True
        self._started_at = started_at
        self._finishes_at = finishes_at
        self._active_duration = self._coerce_stored_duration(
            run_state.get("duration"), started_at, finishes_at
        )
        self._active_source = run_state.get("source")
        self._active_schedule_id = run_state.get("schedule_id")
        # Restore the pH/EC snapshot persisted at the ORIGINAL start of this
        # run (see _async_start_run): without this, a resumed run that later
        # finishes normally would log ph_value/ec_value as None in history,
        # discarding a reading that was genuinely captured and persisted.
        self._active_ph_value = run_state.get("ph_value")
        self._active_ec_value = run_state.get("ec_value")
        self._active_ec_unit = run_state.get("ec_unit")
        self._active_ph_value_2 = run_state.get("ph_value_2")
        self._active_ec_value_2 = run_state.get("ec_value_2")
        self._active_ec_unit_2 = run_state.get("ec_unit_2")
        self._unsub_stop = async_track_point_in_time(
            self.hass, self._async_stop_timer_fired, finishes_at
        )
        # Verify the target actually shows as actuated: a resumed run only
        # re-arms the STOP timer, never the actuation-grace check that a
        # fresh run gets, so without this a target that never really turned
        # on before the crash would otherwise sit "watering" until
        # finishes_at with nothing to notice it never actuated. Checked
        # ONCE, immediately (no grace window -- if the process is running
        # again long enough to reach here, any real async delay has long
        # since elapsed).
        if not self._async_target_is_actuated():
            _LOGGER.error(
                "Resumed run for %s but %s is not actuated; aborting "
                "defensively instead of waiting until %s",
                self.entry.entry_id,
                self.target_entity_id,
                finishes_at.isoformat(),
            )
            # Let _async_finish_run own the turn_off: it retries with
            # confirmation and, if the target still cannot be confirmed off
            # (e.g. unavailable right after boot), PRESERVES the runtime
            # store entry so the NEXT boot retries -- consistent with
            # _async_actuation_check_fired. A single fire-and-forget attempt
            # here would unconditionally discard the recovery record even if
            # the target might still be open.
            await self._async_finish_run(
                turn_off=True, remove_state=True, log_history=False
            )
            data = await self.store.async_load()
            return self.entry.entry_id in data["entries"]
        self._active_actuated = True
        stored_run_uid = run_state.get("run_uid")
        if not isinstance(stored_run_uid, str) or not stored_run_uid:
            stored_run_uid = uuid.uuid4().hex

            def _add_run_uid(current: dict[str, Any] | None) -> dict[str, Any] | None:
                if current is None:
                    return None
                current["run_uid"] = stored_run_uid
                return current

            await self.store.async_update_entry(self.entry.entry_id, _add_run_uid)
        self._active_run_uid = stored_run_uid
        await self._async_store_mark_actuated(stored_run_uid)
        _LOGGER.info(
            "Resumed watering for %s until %s",
            self.entry.entry_id,
            finishes_at.isoformat(),
        )
        return False

    def _coerce_stored_duration(
        self,
        raw_duration: Any,
        started_at: datetime | None,
        finishes_at: datetime,
    ) -> int:
        """Best-effort, non-raising coercion of a stored run's duration.

        Only feeds the in-memory/display ``active_duration`` (the stop timer
        above is armed against ``finishes_at`` directly), so an invalid value
        falls back to the span between ``started_at`` (or now, if that is
        ALSO invalid) and ``finishes_at`` instead of raising.
        """
        if (
            isinstance(raw_duration, int)
            and not isinstance(raw_duration, bool)
            and MIN_DURATION <= raw_duration <= MAX_SCHEDULE_DURATION
        ):
            return raw_duration
        fallback_start = started_at or dt_util.utcnow()
        computed = int((finishes_at - fallback_start).total_seconds())
        clamped = max(MIN_DURATION, min(computed, MAX_SCHEDULE_DURATION))
        _LOGGER.warning(
            "Invalid duration %r in runtime store for %s; using computed %ss",
            raw_duration,
            self.entry.entry_id,
            clamped,
        )
        return clamped

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------
    async def _async_call_target_service(self, turn_on: bool) -> None:
        """Turn the target entity on/off with the service mapped for its domain."""
        service_domain, turn_on_service, turn_off_service = resolve_target_services(
            self.target_domain
        )
        service = turn_on_service if turn_on else turn_off_service
        await self.hass.services.async_call(
            service_domain,
            service,
            {"entity_id": self.target_entity_id},
            blocking=True,
        )

    def _async_target_is_actuated(self) -> bool:
        """Return True if the target entity is currently NOT in an off state."""
        state = self.hass.states.get(self.target_entity_id)
        if state is None:
            return False
        return state.state not in off_states(self.target_domain)

    def _async_target_is_off(self) -> bool:
        """Return True if the target entity is CONFIRMED off right now.

        Used to decide whether it is safe to discard the runtime store entry
        (the restart-recovery safety net). Requires an affirmative
        ``off``/``closed`` report -- ``unavailable``/``unknown`` do NOT count:
        a device that merely stopped reporting is not proof the valve
        physically closed, so the recovery record must survive until a real
        confirmation arrives (or the next boot retries defensively).
        """
        state = self.hass.states.get(self.target_entity_id)
        if state is None:
            return False
        return state.state in confirmed_off_states(self.target_domain)

    async def _async_wait(self, delay: float) -> None:
        """Wait ``delay`` seconds via ``async_call_later`` (test-advanceable).

        Real wall-clock wait for the turn_off retry backoff; in the HA test
        harness it fires when the test advances the loop's time.
        """
        done = asyncio.Event()
        unsub = async_call_later(self.hass, delay, lambda *_: done.set())
        try:
            await done.wait()
        finally:
            unsub()

    def _async_dispatch_update(self) -> None:
        """Notify all entities of this entry that something changed."""
        async_dispatcher_send(
            self.hass, SIGNAL_UPDATE.format(entry_id=self.entry.entry_id)
        )
