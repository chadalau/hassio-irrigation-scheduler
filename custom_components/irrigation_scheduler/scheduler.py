"""Core scheduling engine for the Irrigation Scheduler integration.

``compute_next_run`` (plus ``find_next_run``, ``resolve_target_services`` and
``off_states``) live in :mod:`irrigation_scheduler.next_run`, a module with
ZERO Home Assistant imports that can be unit tested with plain pytest. This
module imports Home Assistant normally (no ``try/except ImportError`` guard:
a missing/renamed HA symbol must fail loudly at load time, not silently in the
middle of a watering run) and re-exports ``compute_next_run`` for backwards
compatibility.

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
"""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timedelta
from functools import partial
from typing import Any, Callable

from homeassistant.core import CoreState, Event, HomeAssistant, callback
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
    CONF_ENABLED,
    CONF_FLOW_RATE_LPH,
    CONF_MAX_DURATION,
    CONF_NUMBER_OF_POTS,
    CONF_SCHEDULE_DURATION,
    CONF_SCHEDULE_ID,
    CONF_SCHEDULES,
    CONF_TARGET_ENTITY_ID,
    DEFAULT_DEFAULT_DURATION,
    DEFAULT_ENABLED,
    DEFAULT_FLOW_RATE_LPH,
    DEFAULT_MAX_DURATION,
    DEFAULT_NUMBER_OF_POTS,
    DOMAIN,
    MAX_SCHEDULE_DURATION,
    MIN_DURATION,
    SIGNAL_UPDATE,
    SOURCE_MANUAL,
    SOURCE_SCHEDULE,
)
from .next_run import (
    compute_next_run,  # noqa: F401 - re-exported for backwards compatibility
    find_next_run,
    off_states,
    resolve_target_services,
)
from .schedules import merge_schedule_update

_LOGGER = logging.getLogger(__name__)

# Hard limit and backoff for the turn_off retry loop in ``_async_finish_run``.
# If the target cannot be CONFIRMED off (current entity state) after all
# attempts, the runtime store entry is KEPT: it is the restart-recovery safety
# net that defensively turns the target off after the next boot.
TURN_OFF_MAX_ATTEMPTS = 3
TURN_OFF_RETRY_DELAY = 1


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

        # Active run state (in-memory mirror of the store).
        self._is_watering = False
        self._started_at: datetime | None = None
        self._finishes_at: datetime | None = None
        self._active_duration: int | None = None
        self._active_source: str | None = None
        self._active_schedule_id: str | None = None

        # When we issue our own turn_on/turn_off we must not react to it.
        self._suppress_state_listener = False

        # Run generation token: incremented on every run start and finish. The
        # state-change listener captures it when the event fires and passes it
        # back, so a stale/reordered callback can never finish the wrong run.
        self._run_id = 0

        # Next scheduled fire.
        self._next_run: datetime | None = None
        self._next_schedule: dict[str, Any] | None = None

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

        Malformed (non-dict) items are filtered out so corrupted options can
        never crash ``_reschedule_next`` / ``find_next_run``.
        """
        raw = self.entry.options.get(CONF_SCHEDULES, [])
        if not isinstance(raw, (list, tuple)):
            _LOGGER.warning(
                "Invalid schedules in options for %s (expected a list); "
                "ignoring them",
                self.entry.entry_id,
            )
            return []
        schedules = [item for item in raw if isinstance(item, dict)]
        if len(schedules) != len(raw):
            _LOGGER.warning(
                "Filtered %d malformed schedule item(s) for %s",
                len(raw) - len(schedules),
                self.entry.entry_id,
            )
        return schedules

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
        await self._async_recover_state()
        self._unsub_state = async_track_state_change_event(
            self.hass, [self.target_entity_id], self._async_target_state_changed
        )
        self._reschedule_next()

    async def async_unload(self) -> None:
        """Cancel all timers/listeners and stop watering (unless HA is stopping)."""
        self._cancel_next()
        self._cancel_stop()
        self._cancel_actuation()
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
            await self._async_finish_run(turn_off=True, remove_state=True)

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
        options = dict(self.entry.options)
        options[CONF_SCHEDULES] = schedules
        self.hass.config_entries.async_update_entry(self.entry, options=options)

    async def async_set_zone_options(
        self,
        *,
        flow_rate_lph: int | None = None,
        number_of_pots: int | None = None,
    ) -> None:
        """Update optional zone settings (flow rate / number of pots).

        Only the fields that are not ``None`` are changed; the rest of the
        options are preserved. The entry is NOT reloaded (the update listener
        only recalculates the next firing).
        """
        options = dict(self.entry.options)
        if flow_rate_lph is not None:
            options[CONF_FLOW_RATE_LPH] = flow_rate_lph
        if number_of_pots is not None:
            options[CONF_NUMBER_OF_POTS] = number_of_pots
        self.hass.config_entries.async_update_entry(self.entry, options=options)

    async def async_add_schedule(self, schedule: dict[str, Any]) -> None:
        """Append a schedule to the current list."""
        await self.async_set_schedules([*self.schedules, schedule])

    async def async_update_schedule(
        self, schedule_id: str, **fields: Any
    ) -> None:
        """Update the given fields of an existing schedule.

        The schedule ``id`` is immutable after creation: it is never injected,
        replaced or removed here (``merge_schedule_update`` ignores it).
        """
        schedules: list[dict[str, Any]] = []
        for schedule in self.schedules:
            if schedule.get(CONF_SCHEDULE_ID) == schedule_id:
                schedules.append(merge_schedule_update(schedule, fields))
            else:
                schedules.append(schedule)
        await self.async_set_schedules(schedules)

    async def async_remove_schedule(self, schedule_id: str) -> None:
        """Remove a schedule by its id."""
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
        await self._async_finish_run(turn_off=True, remove_state=True)

    async def async_options_updated(self) -> None:
        """React to entry.options changes without reloading the entry.

        Only the next firing is recalculated; an active watering run is never
        interrupted by a reload.
        """
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

        # Security watchdog: clamp to 1..max_duration.
        duration = max(MIN_DURATION, min(int(duration), self.max_duration))

        now_utc = dt_util.utcnow()
        finishes_utc = now_utc + timedelta(seconds=duration)

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

        await self.store.async_save_entry(
            self.entry.entry_id,
            {
                "started_at": now_utc.isoformat(),
                "finishes_at": finishes_utc.isoformat(),
                "duration": duration,
                "source": source,
                "schedule_id": schedule_id,
            },
        )

        service_domain, turn_on_service, _ = resolve_target_services(
            self.target_domain
        )
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
            except Exception:  # noqa: BLE001 - never block the abort path
                _LOGGER.exception(
                    "Failed to defensively turn off %s", self.target_entity_id
                )
            finally:
                self._suppress_state_listener = False
            await self._async_abort_run()
            return
        finally:
            self._suppress_state_listener = False

        # SAFETY NET: arm the stop timer IMMEDIATELY after the turn_on command,
        # before any verification. There must never be a window in which a
        # turn_on was sent without a timer that will turn the target off.
        self._unsub_stop = async_track_point_in_time(
            self.hass, self._async_stop_timer_fired, finishes_utc
        )

        # DEFERRED actuation check. Real devices (Z-Wave, Zigbee, MQTT,
        # motorized valves) are async: the service returns as soon as the
        # command is dispatched and the entity state catches up seconds later,
        # so checking right after turn_on would ALWAYS see "off". Give the
        # target ACTUATION_GRACE; if it still has not actuated by then the run
        # ends loudly and the target is turned off defensively.
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
    ) -> None:
        """Finish the active run: turn the target off and clear run state.

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
        self._started_at = None
        self._finishes_at = None
        self._active_duration = None
        self._active_source = None
        self._active_schedule_id = None

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
                    return

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

            if not off_confirmed:
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

        # A new run may have started while we were turning the target off; in
        # that case leave its state (and store entry) alone.
        if self._run_id != run_id:
            _LOGGER.debug(
                "A new watering run started while finishing %s; keeping it",
                self.entry.entry_id,
            )
            return

        if remove_state:
            await self.store.async_remove_entry(self.entry.entry_id)

        _LOGGER.debug("Watering finished for %s", self.entry.entry_id)
        self._reschedule_next()
        self._async_dispatch_update()

    async def _async_abort_run(self) -> None:
        """Abort a run whose target could not be actuated (fail loudly)."""
        self._cancel_stop()
        self._cancel_actuation()
        self._run_id += 1
        self._is_watering = False
        self._started_at = None
        self._finishes_at = None
        self._active_duration = None
        self._active_source = None
        self._active_schedule_id = None
        await self.store.async_remove_entry(self.entry.entry_id)
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
        # Defensive turn-off BEFORE ending the run: _async_finish_run below is
        # called with turn_off=False, so this is the only turn_off issued.
        self._suppress_state_listener = True
        try:
            await self._async_call_target_service(False)
        except Exception:  # noqa: BLE001 - never block the abort path
            _LOGGER.exception(
                "Failed to defensively turn off %s", self.target_entity_id
            )
        finally:
            self._suppress_state_listener = False
        await self._async_finish_run(
            turn_off=False, remove_state=True, expected_run_id=expected_run_id
        )

    async def _async_schedule_fired(self, *_: Any) -> None:
        """The scheduled next-run timer fired."""
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
                await self._async_start_run(
                    duration=int(schedule[CONF_SCHEDULE_DURATION]),
                    source=SOURCE_SCHEDULE,
                    schedule_id=schedule.get(CONF_SCHEDULE_ID),
                )
        self._reschedule_next()

    async def _async_target_state_changed(self, event: Event) -> None:
        """React to the target entity turning off externally."""
        run_id = self._run_id
        if self._suppress_state_listener or not self._is_watering:
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
        if self._started_at is not None and dt_util.utcnow() < self._started_at + timedelta(
            seconds=grace
        ):
            return
        # Decide by the CURRENT entity state, never by the ``new_state``
        # snapshot carried in the event. With an async device the echo of our
        # own turn_off can arrive AFTER a newer run started: the event payload
        # is a stale picture from when it fired, while the state machine may
        # already reflect the newer run (target ON). Trusting the event would
        # kill the newer run and leave the valve open with no timer.
        current = self.hass.states.get(self.target_entity_id)
        if current is None or current.state in off_states(self.target_domain):
            _LOGGER.info(
                "Target %s is %s while watering; stopping run for %s",
                self.target_entity_id,
                current.state if current is not None else "unknown",
                self.entry.entry_id,
            )
            await self._async_finish_run(
                turn_off=False, remove_state=True, expected_run_id=run_id
            )

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

    # ------------------------------------------------------------------
    # Restart recovery
    # ------------------------------------------------------------------
    async def _async_recover_state(self) -> None:
        """Resume an interrupted run, or defensively turn the target off."""
        data = await self.store.async_load()
        run_state = data["entries"].get(self.entry.entry_id)
        if not run_state:
            return

        finishes_at = dt_util.parse_datetime(run_state.get("finishes_at"))
        if finishes_at is None:
            _LOGGER.warning(
                "Invalid finishes_at in runtime store for %s; discarding",
                self.entry.entry_id,
            )
            await self.store.async_remove_entry(self.entry.entry_id)
            return

        if finishes_at <= dt_util.utcnow():
            _LOGGER.warning(
                "Run for %s finished during downtime; turning %s off defensively",
                self.entry.entry_id,
                self.target_entity_id,
            )
            self._suppress_state_listener = True
            try:
                await self._async_call_target_service(False)
            except Exception:  # noqa: BLE001 - never block startup
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
                await self.store.async_remove_entry(self.entry.entry_id)
            else:
                _LOGGER.error(
                    "Defensive turn_off of %s failed; keeping runtime state "
                    "so the next boot retries for %s",
                    self.target_entity_id,
                    self.entry.entry_id,
                )
            return

        # Resume: keep the run state and re-arm the stop timer.
        started_at = dt_util.parse_datetime(run_state.get("started_at"))
        self._run_id += 1
        self._is_watering = True
        self._started_at = started_at
        self._finishes_at = finishes_at
        self._active_duration = int(run_state.get("duration", 0))
        self._active_source = run_state.get("source")
        self._active_schedule_id = run_state.get("schedule_id")
        self._unsub_stop = async_track_point_in_time(
            self.hass, self._async_stop_timer_fired, finishes_at
        )
        _LOGGER.info(
            "Resumed watering for %s until %s",
            self.entry.entry_id,
            finishes_at.isoformat(),
        )

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
        """Return True if the target entity is currently in an off state.

        Used to confirm a turn_off actually took effect before the runtime
        store entry is removed.
        """
        state = self.hass.states.get(self.target_entity_id)
        if state is None:
            return False
        return state.state in off_states(self.target_domain)

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
