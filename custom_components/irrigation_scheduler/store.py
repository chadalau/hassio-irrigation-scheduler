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
          "schedule_id": "a1b2c3d4" | None
        }
      }
    }
"""

from __future__ import annotations

import asyncio
from typing import Any

from homeassistant.core import HomeAssistant
from homeassistant.helpers.storage import Store

from .const import STORE_KEY, STORE_VERSION


class RuntimeStore:
    """Store for volatile watering run state (survives restart only).

    One instance is shared by every config entry of the integration. All
    read-modify-write cycles run under a single lock so concurrent zones can
    never clobber each other's entries.
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

    async def async_remove_entry(self, entry_id: str) -> None:
        """Remove the run state for a config entry, if present."""
        async with self._lock:
            data = await self._async_load_unlocked()
            if entry_id in data["entries"]:
                del data["entries"][entry_id]
                await self._store.async_save(data)

    async def _async_load_unlocked(self) -> dict[str, Any]:
        """Load the payload; the caller MUST hold ``self._lock``."""
        data = await self._store.async_load()
        if data is None:
            data = {}
        data.setdefault("entries", {})
        return data
