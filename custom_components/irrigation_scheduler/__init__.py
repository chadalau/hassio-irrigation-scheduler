"""Irrigation Scheduler integration.

Backend (Onda A): one config entry per irrigation zone. Each entry drives a
target entity (valve/switch) at scheduled times, turns it off automatically,
and survives restarts through a volatile runtime store.
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

import voluptuous as vol

from homeassistant.components.frontend import (
    DATA_EXTRA_MODULE_URL,
    add_extra_js_url,
    remove_extra_js_url,
)
from homeassistant.components.http import StaticPathConfig
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, ServiceCall, ServiceResponse
from homeassistant.exceptions import ServiceValidationError
from homeassistant.helpers import config_validation as cv, entity_registry as er
from homeassistant.helpers.target import (
    TargetSelection,
    async_extract_referenced_entity_ids,
)
from homeassistant.helpers.typing import ConfigType

from .const import (
    CARD_JS_FILENAME,
    CARD_JS_URL,
    CONF_ENABLED,
    CONF_SCHEDULE_DAYS,
    CONF_SCHEDULE_DURATION,
    CONF_SCHEDULE_ID,
    CONF_SCHEDULE_TIME,
    CONF_SCHEDULES,
    DOMAIN,
    MAX_SCHEDULE_DURATION,
    MIN_DURATION,
    PLATFORMS,
    SERVICE_ADD_SCHEDULE,
    SERVICE_REMOVE_SCHEDULE,
    SERVICE_SET_SCHEDULES,
    SERVICE_STOP,
    SERVICE_UPDATE_SCHEDULE,
    SERVICE_WATER_NOW,
)

_LOGGER = logging.getLogger(__name__)
from .schedules import new_schedule, serialize_schedule
from .scheduler import IrrigationScheduler
from .store import RuntimeStore

# The integration is config-entry-only: no YAML platform configuration.
CONFIG_SCHEMA = cv.config_entry_only_config_schema(DOMAIN)

# ---------------------------------------------------------------------------
# Voluptuous schemas (spec-mandated for schedules)
# ---------------------------------------------------------------------------
SCHEDULE_SCHEMA = vol.Schema(
    {
        vol.Optional(CONF_SCHEDULE_ID): cv.string,
        vol.Required(CONF_SCHEDULE_TIME): cv.time,
        vol.Required(CONF_SCHEDULE_DAYS): vol.All(
            cv.ensure_list,
            [
                vol.All(vol.Coerce(int), vol.Range(min=0, max=6))
            ],
            vol.Length(min=1),
        ),
        vol.Required(CONF_SCHEDULE_DURATION): vol.All(
            vol.Coerce(int), vol.Range(min=MIN_DURATION, max=MAX_SCHEDULE_DURATION)
        ),
        vol.Optional(CONF_ENABLED, default=True): cv.boolean,
    }
)

WATER_NOW_SCHEMA = vol.Schema(
    {
        vol.Optional("duration"): vol.All(
            vol.Coerce(int), vol.Range(min=MIN_DURATION, max=MAX_SCHEDULE_DURATION)
        )
    }
)

STOP_SCHEMA = vol.Schema({})

UPDATE_SCHEDULE_SCHEMA = vol.Schema(
    {
        vol.Required(CONF_SCHEDULE_ID): cv.string,
        vol.Optional(CONF_SCHEDULE_TIME): cv.time,
        vol.Optional(CONF_SCHEDULE_DAYS): vol.All(
            cv.ensure_list,
            [
                vol.All(vol.Coerce(int), vol.Range(min=0, max=6))
            ],
            vol.Length(min=1),
        ),
        vol.Optional(CONF_SCHEDULE_DURATION): vol.All(
            vol.Coerce(int), vol.Range(min=MIN_DURATION, max=MAX_SCHEDULE_DURATION)
        ),
        vol.Optional(CONF_ENABLED): cv.boolean,
    }
)

REMOVE_SCHEDULE_SCHEMA = vol.Schema(
    {vol.Required(CONF_SCHEDULE_ID): cv.string}
)

# Keys Home Assistant injects into a targeted service call. They are target
# selectors (or frontend bookkeeping), not service data, and must be stripped
# before voluptuous validation (the schemas are strict and reject extra keys).
_TARGET_KEYS = (
    "entity_id",
    "device_id",
    "area_id",
    "floor_id",
    "label_id",
    "metadata",
)


def _coerce_days(value: Any) -> Any:
    """Normalize a days value (dict/list/comma string) into a list."""
    if isinstance(value, dict):
        return [key for key, selected in value.items() if selected]
    if isinstance(value, str):
        return [part.strip() for part in value.split(",") if part.strip()]
    return value


def _prepare_schedule_data(data: dict[str, Any]) -> dict[str, Any]:
    """Pre-process raw schedule data before voluptuous validation."""
    prepared = dict(data)
    if CONF_SCHEDULE_DAYS in prepared:
        prepared[CONF_SCHEDULE_DAYS] = _coerce_days(prepared[CONF_SCHEDULE_DAYS])
    return prepared


def _service_data(call: ServiceCall) -> dict[str, Any]:
    """Return call data without the auto-added HA target keys."""
    data = dict(call.data)
    for key in _TARGET_KEYS:
        data.pop(key, None)
    return data


# ---------------------------------------------------------------------------
# Setup
# ---------------------------------------------------------------------------
async def async_setup(hass: HomeAssistant, config: ConfigType) -> bool:
    """Set up the integration (services + frontend wiring, once)."""
    hass.data.setdefault(DOMAIN, {})
    await _async_register_services(hass)
    await _async_register_frontend(hass)
    return True


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Set up one irrigation zone (config entry)."""
    await _async_register_services(hass)

    hass.data.setdefault(DOMAIN, {})
    # A SINGLE RuntimeStore shared by every entry: all entries persist to the
    # same file and the store serializes read-modify-write under one lock. It
    # stays global (hass.data), NOT per entry: runtime_data is per-entry.
    store = hass.data[DOMAIN].setdefault("store", RuntimeStore(hass))

    scheduler = IrrigationScheduler(hass, entry, store)
    await scheduler.async_setup()

    # Per-entry runtime data lives on the entry itself (modern HA pattern);
    # Home Assistant clears it automatically when the entry is unloaded.
    entry.runtime_data = scheduler

    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)

    # IMPORTANT (acceptance criterion): the update listener must NOT reload the
    # entry, otherwise an active watering run would be killed on option change.
    entry.async_on_unload(entry.add_update_listener(_async_update_listener))
    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Unload one irrigation zone."""
    scheduler: IrrigationScheduler = entry.runtime_data
    await scheduler.async_unload()

    unload_ok = await hass.config_entries.async_unload_platforms(entry, PLATFORMS)
    if unload_ok and not hass.config_entries.async_loaded_entries(DOMAIN):
        # Services and the frontend extra JS URL are shared: they are only
        # removed when the LAST entry unloads. runtime_data of this entry is
        # cleared by HA afterwards.
        _async_unregister_services(hass)
        _async_unregister_frontend(hass)
    return unload_ok


async def _async_update_listener(hass: HomeAssistant, entry: ConfigEntry) -> None:
    """Handle option changes without reloading the entry."""
    scheduler: IrrigationScheduler = entry.runtime_data
    await scheduler.async_options_updated()


# ---------------------------------------------------------------------------
# Frontend (Onda B1): serve + register the card JS with Lovelace.
# The card itself (Lit/TS) is Onda B2 and replaces the placeholder file.
# ---------------------------------------------------------------------------
async def _async_register_frontend(hass: HomeAssistant) -> None:
    """Serve and register the card JS.

    Runs ONCE during component setup (never per entry). The static path has no
    trivial unregister API and intentionally stays for the process lifetime;
    the extra JS URL is removed when the last entry unloads. Both registrations
    are defensive: the backend must never fail to set up because the card file
    or the frontend component is missing.
    """
    if hass.http is None:
        _LOGGER.warning(
            "The http component is not loaded; cannot serve the Irrigation "
            "Scheduler card at %s",
            CARD_JS_URL,
        )
        return

    js_path = Path(
        hass.config.path("custom_components", DOMAIN, "frontend", CARD_JS_FILENAME)
    )
    if not js_path.is_file():
        _LOGGER.warning(
            "Irrigation Scheduler card JS not found at %s (Onda B2 build not "
            "present yet); the card will not be served nor registered",
            js_path,
        )
        return

    await hass.http.async_register_static_paths(
        [StaticPathConfig(CARD_JS_URL, str(js_path), cache_headers=False)]
    )

    if hass.data.get(DATA_EXTRA_MODULE_URL) is None:
        # frontend is a declared dependency, but keep the backend alive if it
        # is not actually loaded (e.g. frontend disabled on this install).
        _LOGGER.warning(
            "The frontend component is not loaded; served %s but could not "
            "register it as an extra module URL",
            CARD_JS_URL,
        )
        return

    add_extra_js_url(hass, CARD_JS_URL)


def _async_unregister_frontend(hass: HomeAssistant) -> None:
    """Remove the extra JS URL when the last entry unloads."""
    if hass.data.get(DATA_EXTRA_MODULE_URL) is not None:
        remove_extra_js_url(hass, CARD_JS_URL)


# ---------------------------------------------------------------------------
# Services
# ---------------------------------------------------------------------------
async def _async_register_services(hass: HomeAssistant) -> None:
    """Register all services exactly once.

    Services are registered without a schema because the call data of a
    targeted service always contains ``entity_id`` (plus possibly
    ``device_id``/``area_id``/``floor_id``/``label_id``); every handler strips
    those target keys and then validates its fields with the voluptuous
    schemas above.
    """
    if hass.services.has_service(DOMAIN, SERVICE_WATER_NOW):
        return

    async def _async_water_now(call: ServiceCall) -> ServiceResponse:
        data = WATER_NOW_SCHEMA(_service_data(call))
        for scheduler in await _async_resolve_schedulers(hass, call):
            await scheduler.async_water_now(duration=data.get("duration"))
        return None

    async def _async_stop(call: ServiceCall) -> ServiceResponse:
        STOP_SCHEMA(_service_data(call))
        for scheduler in await _async_resolve_schedulers(hass, call):
            await scheduler.async_stop()
        return None

    async def _async_add_schedule(call: ServiceCall) -> ServiceResponse:
        data = _prepare_schedule_data(_service_data(call))
        # Id is generated ONLY on creation (new_schedule), never on update.
        schedule = new_schedule(SCHEDULE_SCHEMA(data))
        for scheduler in await _async_resolve_schedulers(hass, call):
            await scheduler.async_add_schedule(schedule)
        return None

    async def _async_update_schedule(call: ServiceCall) -> ServiceResponse:
        data = _prepare_schedule_data(_service_data(call))
        validated = UPDATE_SCHEDULE_SCHEMA(data)
        schedule_id = validated.pop(CONF_SCHEDULE_ID)
        # serialize_schedule NEVER injects an id: the stored id survives.
        fields = serialize_schedule(validated)
        for scheduler in await _async_resolve_schedulers(hass, call):
            await scheduler.async_update_schedule(schedule_id, **fields)
        return None

    async def _async_remove_schedule(call: ServiceCall) -> ServiceResponse:
        data = REMOVE_SCHEDULE_SCHEMA(_service_data(call))
        for scheduler in await _async_resolve_schedulers(hass, call):
            await scheduler.async_remove_schedule(data[CONF_SCHEDULE_ID])
        return None

    async def _async_set_schedules(call: ServiceCall) -> ServiceResponse:
        data = _prepare_schedule_data(_service_data(call))
        raw_schedules = cv.ensure_list(data[CONF_SCHEDULES])
        schedules: list[dict[str, Any]] = []
        for index, item in enumerate(raw_schedules):
            # ``dict(item)`` on a non-dict item (e.g. a bare string) raises a
            # raw ``ValueError``; surface a validation error naming the item.
            if not isinstance(item, dict):
                raise ServiceValidationError(
                    f"Schedule at index {index} is not a dictionary "
                    f"(got {type(item).__name__})"
                )
            schedules.append(
                new_schedule(SCHEDULE_SCHEMA(_prepare_schedule_data(item)))
            )
        for scheduler in await _async_resolve_schedulers(hass, call):
            await scheduler.async_set_schedules(schedules)
        return None

    for service, handler in (
        (SERVICE_WATER_NOW, _async_water_now),
        (SERVICE_STOP, _async_stop),
        (SERVICE_ADD_SCHEDULE, _async_add_schedule),
        (SERVICE_UPDATE_SCHEDULE, _async_update_schedule),
        (SERVICE_REMOVE_SCHEDULE, _async_remove_schedule),
        (SERVICE_SET_SCHEDULES, _async_set_schedules),
    ):
        hass.services.async_register(DOMAIN, service, handler, schema=None)


def _async_unregister_services(hass: HomeAssistant) -> None:
    """Remove all services when the last entry is unloaded."""
    for service in (
        SERVICE_WATER_NOW,
        SERVICE_STOP,
        SERVICE_ADD_SCHEDULE,
        SERVICE_UPDATE_SCHEDULE,
        SERVICE_REMOVE_SCHEDULE,
        SERVICE_SET_SCHEDULES,
    ):
        if hass.services.has_service(DOMAIN, service):
            hass.services.async_remove(DOMAIN, service)


async def _async_resolve_schedulers(
    hass: HomeAssistant, call: ServiceCall
) -> list[IrrigationScheduler]:
    """Resolve the scheduler(s) for the targeted entities/devices/areas.

    Uses ``homeassistant.helpers.target.async_extract_referenced_entity_ids``
    (the same helper Home Assistant's core uses for targeted service calls) so
    calls may target entities, devices, areas, floors or labels. Entities that
    belong to other integrations are skipped (targeting an area naturally
    includes them). Raises ``ServiceValidationError`` when no scheduler
    matches.
    """
    target_selection = TargetSelection(call.data)
    referenced = async_extract_referenced_entity_ids(hass, target_selection)
    entity_ids = list(referenced.referenced | referenced.indirectly_referenced)
    if not entity_ids:
        raise ServiceValidationError(
            "No entity_id provided for an irrigation_scheduler service call"
        )

    entity_registry = er.async_get(hass)
    schedulers: list[IrrigationScheduler] = []
    seen_entry_ids: set[str] = set()

    for entity_id in entity_ids:
        entity_entry = entity_registry.async_get(entity_id)
        if entity_entry is None or entity_entry.config_entry_id is None:
            continue
        entry = hass.config_entries.async_get_entry(entity_entry.config_entry_id)
        if entry is None or entry.domain != DOMAIN:
            continue
        # runtime_data holds the scheduler while the entry is loaded; HA
        # deletes the attribute when the entry is unloaded, hence getattr.
        scheduler = getattr(entry, "runtime_data", None)
        if scheduler is None:
            continue
        if entry.entry_id not in seen_entry_ids:
            seen_entry_ids.add(entry.entry_id)
            schedulers.append(scheduler)

    if not schedulers:
        raise ServiceValidationError(
            "No irrigation_scheduler entity matched the service call"
        )
    return schedulers
