"""Sensor platform: reports the next scheduled run of a zone."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from homeassistant.components.sensor import SensorDeviceClass, SensorEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers import entity_registry as er
from homeassistant.helpers.device_registry import DeviceInfo
from homeassistant.helpers.dispatcher import async_dispatcher_connect
from homeassistant.helpers.entity_platform import AddConfigEntryEntitiesCallback
from homeassistant.helpers.start import async_at_started

from .const import CONF_NAME, DOMAIN, NAME, SIGNAL_UPDATE
from .scheduler import IrrigationScheduler


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddConfigEntryEntitiesCallback,
) -> None:
    """Set up the next-run sensor for the zone."""
    scheduler: IrrigationScheduler = entry.runtime_data
    async_add_entities([IrrigationSchedulerSensor(scheduler)])


class IrrigationSchedulerSensor(SensorEntity):
    """Sensor exposing the next scheduled run time."""

    _attr_has_entity_name = True
    _attr_translation_key = "next_run"
    _attr_device_class = SensorDeviceClass.TIMESTAMP
    _attr_icon = "mdi:clock-start"
    _attr_should_poll = False

    def __init__(self, scheduler: IrrigationScheduler) -> None:
        """Initialize the sensor."""
        self._scheduler = scheduler
        self._attr_unique_id = f"{scheduler.entry.entry_id}_next_run"
        self._attr_device_info = DeviceInfo(
            identifiers={(DOMAIN, scheduler.entry.entry_id)},
            name=scheduler.entry.data[CONF_NAME],
            manufacturer=NAME,
        )
        # Sibling entity ids (attribute contract for the Onda-B card). They are
        # resolved ONCE after Home Assistant has started and then cached, so the
        # contract can never be born null just because the three platforms of an
        # entry happen to be loaded in an order where the registry entries are
        # not all present yet.
        self._switch_entity_id: str | None = None
        self._binary_sensor_entity_id: str | None = None
        self._entities_resolved = False

    @property
    def native_value(self) -> datetime | None:
        """Return the next scheduled run time."""
        return self._scheduler.next_run

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        """Extra attributes consumed by the Onda-B card (names are a contract)."""
        return {
            "schedules": self._scheduler.schedules,
            "target_entity_id": self._scheduler.target_entity_id,
            "default_duration": self._scheduler.default_duration,
            "max_duration": self._scheduler.max_duration,
            "flow_rate_lph": self._scheduler.flow_rate_lph,
            "number_of_pots": self._scheduler.number_of_pots,
            "reservoir_volume_l": self._scheduler.reservoir_volume_l,
            "ph_entity_id": self._scheduler.ph_entity_id,
            "ph_min": self._scheduler.ph_min,
            "ph_max": self._scheduler.ph_max,
            "schedule_warnings": self._scheduler.schedule_warnings,
            "switch_entity_id": self._switch_entity_id,
            "binary_sensor_entity_id": self._binary_sensor_entity_id,
        }

    def _find_entity_id(self, translation_key: str) -> str | None:
        """Resolve the entity_id of a sibling entity in the same config entry."""
        registry = er.async_get(self.hass)
        for entity_entry in er.async_entries_for_config_entry(
            registry, self._scheduler.entry.entry_id
        ):
            if entity_entry.translation_key == translation_key:
                return entity_entry.entity_id
        return None

    async def async_added_to_hass(self) -> None:
        """Subscribe to scheduler updates and resolve sibling entity ids."""
        self.async_on_remove(
            async_dispatcher_connect(
                self.hass,
                SIGNAL_UPDATE.format(entry_id=self._scheduler.entry.entry_id),
                self._async_handle_update,
            )
        )
        # Resolve once, after HA has started (all platforms are loaded by then).
        # async_at_started runs immediately if HA is already running.
        self.async_on_remove(async_at_started(self.hass, self._async_resolve_entity_ids))
        # When HA is already running (runtime entry setup, tests), async_at_started
        # fires before the sibling platforms may be registered yet. Re-attempt
        # whenever the entity registry of this entry changes until both
        # siblings resolve, so the attribute contract is never born null.
        self.async_on_remove(
            self.hass.bus.async_listen(
                er.EVENT_ENTITY_REGISTRY_UPDATED, self._async_registry_updated
            )
        )

    @callback
    def _async_registry_updated(self, event: Any) -> None:
        """Re-attempt sibling resolution when this entry's registry changes."""
        if event.data.get("action") == "remove":
            return
        entity_entry = er.async_get(self.hass).async_get(event.data["entity_id"])
        if (
            entity_entry is None
            or entity_entry.config_entry_id != self._scheduler.entry.entry_id
        ):
            return
        self.hass.async_create_task(self._async_resolve_entity_ids())

    async def _async_resolve_entity_ids(
        self, _hass: HomeAssistant | None = None
    ) -> None:
        """Resolve and cache sibling entity ids, then refresh state.

        ``_hass`` is accepted because ``async_at_started`` invokes its callback
        with the ``HomeAssistant`` instance as the first positional argument.
        The resolution is only considered complete once BOTH siblings are
        found; otherwise the registry listener above keeps re-attempting.
        """
        if self._entities_resolved:
            return
        self._switch_entity_id = self._find_entity_id("schedule_enabled")
        self._binary_sensor_entity_id = self._find_entity_id("watering")
        if (
            self._switch_entity_id is not None
            and self._binary_sensor_entity_id is not None
        ):
            self._entities_resolved = True
        self.async_write_ha_state()

    @callback
    def _async_handle_update(self) -> None:
        """Refresh state when the scheduler notifies us."""
        self.async_write_ha_state()
