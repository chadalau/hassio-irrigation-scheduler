"""Integration tests for RuntimeStore.async_update_entry.

REGRESSION: two callers each doing their OWN independent load() ->
save_entry() cycle for the SAME entry_id can race -- each holds a stale
local snapshot from an earlier, separately-locked load(), so whichever
saves LAST silently discards the other's already-persisted field change.
This was reproduced with a forced interleaving in the scheduler's
_async_store_mark_actuated/_async_store_mark_history_logged (both touch the
same active-run entry). async_update_entry closes it by holding the store's
lock across the WHOLE load-mutate-save cycle, so no caller can ever observe
-- or silently overwrite -- a half-applied state for the same entry.
"""

from __future__ import annotations

import asyncio

from homeassistant.core import HomeAssistant

from custom_components.irrigation_scheduler.store import RuntimeStore


def _store(hass: HomeAssistant) -> RuntimeStore:
    return RuntimeStore(hass)


async def test_update_entry_creates_new_entry_via_mutator(hass: HomeAssistant) -> None:
    store = _store(hass)

    def _mutate(current):
        assert current is None
        return {"value": 1}

    await store.async_update_entry("zone-a", _mutate)

    data = await store.async_load()
    assert data["entries"]["zone-a"] == {"value": 1}


async def test_update_entry_no_op_when_mutator_returns_none(hass: HomeAssistant) -> None:
    store = _store(hass)
    await store.async_save_entry("zone-a", {"value": 1})

    def _mutate(current):
        return None

    await store.async_update_entry("zone-a", _mutate)

    data = await store.async_load()
    assert data["entries"]["zone-a"] == {"value": 1}


async def test_update_entry_does_not_touch_other_entries(hass: HomeAssistant) -> None:
    store = _store(hass)
    await store.async_save_entry("zone-a", {"value": 1})
    await store.async_save_entry("zone-b", {"value": 2})

    await store.async_update_entry("zone-a", lambda current: {"value": 99})

    data = await store.async_load()
    assert data["entries"]["zone-a"] == {"value": 99}
    assert data["entries"]["zone-b"] == {"value": 2}


async def test_update_entry_serializes_concurrent_mutations_of_the_same_entry(
    hass: HomeAssistant,
) -> None:
    """Two concurrent updates to DIFFERENT fields of the SAME entry must
    both land -- neither may clobber the other, regardless of scheduling
    order. Before the fix (two separate load()+save_entry() calls instead
    of one atomic cycle), this reliably lost one of the two fields under a
    forced interleaving."""
    store = _store(hass)

    for _ in range(20):
        await store.async_save_entry("zone-a", {"field_1": False, "field_2": False})

        def _mark_field_1(current):
            if current is None or current.get("field_1"):
                return None
            current["field_1"] = True
            return current

        def _mark_field_2(current):
            if current is None:
                return None
            current["field_2"] = True
            return current

        await asyncio.gather(
            store.async_update_entry("zone-a", _mark_field_1),
            store.async_update_entry("zone-a", _mark_field_2),
        )

        data = await store.async_load()
        run_state = data["entries"]["zone-a"]
        assert run_state["field_1"] is True
        assert run_state["field_2"] is True
