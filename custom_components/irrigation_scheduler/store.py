"""Volatile runtime state persistence.

Run state (an active watering) must survive a restart, but it is NOT part of
the config entry options. This module wraps ``homeassistant.helpers.storage.
Store`` so that the scheduler can save/load/remove its run state per entry.

The whole load->modify->save cycle is guarded by an ``asyncio.Lock``. Multiple
zones share a SINGLE ``RuntimeStore`` instance (see ``__init__.py``) because
every entry writes to the same on-disk file; without the lock and the shared
instance, concurrent read-modify-write cycles from different zones would
silently overwrite each other's state and corrupt restart recovery.

Shape of the stored payload::

    {
      "entries": {
        "<config_entry_id>": {
          "started_at": "<iso utc>",
          "finishes_at": "<iso utc>",
          "duration": 900,
          "source": "schedule" | "manual",
          "schedule_id": "a1b2c3d4" | None,
          "actuated": false,        # set True once the target is CONFIRMED
                                     # actuated (see IrrigationScheduler.
                                     # _async_store_mark_actuated)
          "history_logged": false   # set True once this run has been
                                     # appended to history, so a surviving
                                     # record is never logged twice
        }
      }
    }
"""

from __future__ import annotations

import asyncio
import logging
from datetime import timedelta
from typing import Any, Callable

from homeassistant.core import HomeAssistant
from homeassistant.helpers.storage import Store
from homeassistant.util import dt as dt_util

from .const import STORE_KEY, STORE_VERSION

_LOGGER = logging.getLogger(__name__)


def _prune_history(
    entries: list[dict[str, Any]], *, max_age_days: int, max_entries: int
) -> list[dict[str, Any]]:
    """Drop entries older than ``max_age_days`` (or with a malformed
    ``started_at``) and cap the result at ``max_entries``. ``entries`` must
    already be most-recent-first.
    """
    cutoff = dt_util.utcnow() - timedelta(days=max_age_days)
    pruned: list[dict[str, Any]] = []
    for entry in entries:
        started_at = dt_util.parse_datetime(entry.get("started_at", ""))
        if started_at is None:
            continue
        # A hand-edited/corrupted store could contain a naive datetime (no
        # tzinfo); every writer in this codebase persists aware UTC
        # isoformat strings, but comparing naive < aware raises TypeError.
        # as_utc() normalizes either shape (assuming local time for naive
        # input) instead of letting a malformed entry crash pruning for
        # every zone sharing this store.
        started_at = dt_util.as_utc(started_at)
        if started_at < cutoff:
            continue
        pruned.append(entry)
    return pruned[:max_entries]


class RuntimeStore:
    """Store for volatile watering run state (survives restart only) AND the
    completed-run history log.

    One instance is shared by every config entry of the integration. All
    read-modify-write cycles run under a single lock so concurrent zones can
    never clobber each other's entries. ``entries`` (active/in-progress run
    state, deleted once a run finishes) and ``history`` (completed runs,
    appended and pruned, never deleted on finish) are DELIBERATELY kept in
    the same payload/lock/file rather than a second Store: they already need
    the exact same locking discipline, and one file avoids the two ever
    drifting out of sync.
    """

    def __init__(self, hass: HomeAssistant) -> None:
        """Initialize the runtime store."""
        self._store: Store[dict[str, Any]] = Store(hass, STORE_VERSION, STORE_KEY)
        self._lock = asyncio.Lock()

    async def async_load(self) -> dict[str, Any]:
        """Load the whole runtime payload, always returning a dict."""
        async with self._lock:
            return await self._async_load_unlocked()

    async def async_save_entry(self, entry_id: str, run_state: dict[str, Any]) -> None:
        """Save (or overwrite) the run state for a config entry."""
        async with self._lock:
            data = await self._async_load_unlocked()
            data["entries"][entry_id] = run_state
            await self._store.async_save(data)

    async def async_create_entry(
        self, entry_id: str, run_state: dict[str, Any]
    ) -> bool:
        """Create a run entry only when none exists, atomically.

        Returns ``False`` without writing when a recovery record already
        occupies ``entry_id``. This prevents external-activation reconciliation
        or a concurrent state event from destroying that older run's identity
        and exactly-once accounting journal.
        """
        async with self._lock:
            data = await self._async_load_unlocked()
            if entry_id in data["entries"]:
                return False
            data["entries"][entry_id] = run_state
            await self._store.async_save(data)
            return True

    async def async_update_entry(
        self,
        entry_id: str,
        mutator: Callable[[dict[str, Any] | None], dict[str, Any] | None],
    ) -> None:
        """Atomically read-modify-write a single entry under ONE lock hold.

        ``mutator`` receives the entry's CURRENT run_state (``None`` if it
        does not exist) and returns the new run_state to persist, or
        ``None`` for a no-op. Unlike calling ``async_load()`` followed by a
        separate ``async_save_entry()`` -- which each acquire/release the
        lock independently -- the whole load->mutate->save cycle here never
        releases the lock in between, so a second concurrent caller for the
        SAME entry_id can never silently discard this write with a stale
        snapshot from its own earlier, independent load (confirmed
        reproducible: two callers each doing their own load+save clobbered
        one another's field-level change to the same entry).
        """
        async with self._lock:
            data = await self._async_load_unlocked()
            current = data["entries"].get(entry_id)
            new_state = mutator(current)
            if new_state is None:
                return
            data["entries"][entry_id] = new_state
            await self._store.async_save(data)

    async def async_remove_entry(
        self, entry_id: str, *, expected_run_uid: str | None = None
    ) -> None:
        """Remove the run state for a config entry, if present."""
        async with self._lock:
            data = await self._async_load_unlocked()
            current = data["entries"].get(entry_id)
            if current is not None and (
                expected_run_uid is None
                or current.get("run_uid") == expected_run_uid
            ):
                del data["entries"][entry_id]
                await self._store.async_save(data)

    async def async_load_history(
        self, entry_id: str, *, max_age_days: int, max_entries: int
    ) -> list[dict[str, Any]]:
        """Load the (pruned) completed-run history for a config entry.

        Pruning on LOAD too (not just on append) matters for restart
        recovery: if HA was off past the retention window, stale entries
        must not resurface just because nothing was appended since.
        """
        async with self._lock:
            data = await self._async_load_unlocked()
            entries = list(data["history"].get(entry_id, []))
            return _prune_history(
                entries, max_age_days=max_age_days, max_entries=max_entries
            )

    async def async_append_history(
        self,
        entry_id: str,
        record: dict[str, Any],
        *,
        max_age_days: int,
        max_entries: int,
    ) -> tuple[list[dict[str, Any]], bool]:
        """Prepend a completed-run record, prune, persist, and return the
        resulting list plus whether this call inserted it.

        ``run_uid`` makes retries/restart recovery idempotent. Legacy records
        without it remain readable and are never considered duplicates.
        """
        async with self._lock:
            data = await self._async_load_unlocked()
            entries = list(data["history"].get(entry_id, []))
            run_uid = record.get("run_uid")
            if run_uid and any(item.get("run_uid") == run_uid for item in entries):
                return (
                    _prune_history(
                        entries, max_age_days=max_age_days, max_entries=max_entries
                    ),
                    False,
                )
            entries.insert(0, record)
            entries = _prune_history(
                entries, max_age_days=max_age_days, max_entries=max_entries
            )
            data["history"][entry_id] = entries
            await self._store.async_save(data)
            return entries, True

    async def _async_load_unlocked(self) -> dict[str, Any]:
        """Load the payload; the caller MUST hold ``self._lock``."""
        data = await self._store.async_load()
        if not isinstance(data, dict):
            if data is not None:
                _LOGGER.error("Invalid runtime Store payload; resetting it")
            data = {}
        if not isinstance(data.get("entries"), dict):
            if "entries" in data:
                _LOGGER.error("Invalid runtime Store entries section; resetting it")
            data["entries"] = {}
        if not isinstance(data.get("history"), dict):
            if "history" in data:
                _LOGGER.error("Invalid runtime Store history section; resetting it")
            data["history"] = {}
        data["entries"] = {
            key: value
            for key, value in data["entries"].items()
            if isinstance(key, str) and isinstance(value, dict)
        }
        data["history"] = {
            key: [item for item in value if isinstance(item, dict)]
            for key, value in data["history"].items()
            if isinstance(key, str) and isinstance(value, list)
        }
        return data
