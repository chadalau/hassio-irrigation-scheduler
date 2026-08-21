"""Binary sensor platform: reports whether a zone is currently watering."""

from __future__ import annotations

from typing import Any

from homeassistant.components.binary_sensor import (
    BinarySensorDeviceClass,
    BinarySensorEntity,
)
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.device_registry import DeviceInfo
from homeassistant.helpers.dispatcher import async_dispatcher_connect
from homeassistant.helpers.entity_platform import AddConfigEntryEntitiesCallback

from .const import CONF_NAME, DOMAIN, NAME, SIGNAL_UPDATE
from .scheduler import IrrigationScheduler


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddConfigEntryEntitiesCallback,
) -> None:
    """Set up the watering binary sensor for the zone."""
    scheduler: IrrigationScheduler = entry.runtime_data
    async_add_entities([IrrigationSchedulerBinarySensor(scheduler)])


class IrrigationSchedulerBinarySensor(BinarySensorEntity):
    """Binary sensor indicating that watering is in progress."""

    # ``history`` (up to HISTORY_MAX_ENTRIES records of ~14 fields each) and
    # the ``last_run`` copy of its first item are a UI payload for the card,
    # not something worth persisting on EVERY state write. Recorder caps a
    # state's serialized attributes at MAX_STATE_ATTRS_BYTES (16 KiB) and
    # DROPS ALL of them past it -- measured at ~377 bytes/record, a zone
    # watering more than ~44 times in the 30-day retention window would
    # silently lose every attribute of this entity (including started_at/
    # finishes_at/source) and log a performance warning on each write.
    # Excluding them here keeps the recorded attributes small and stable;
    # the live state machine still carries the full payload for the card.
    _unrecorded_attributes = frozenset({"history", "last_run"})

    _attr_has_entity_name = True
    _attr_translation_key = "watering"
    _attr_device_class = BinarySensorDeviceClass.RUNNING
    _attr_icon = "mdi:sprinkler-variant"
    _attr_should_poll = False

    def __init__(self, scheduler: IrrigationScheduler) -> None:
        """Initialize the binary sensor."""
        self._scheduler = scheduler
        self._attr_unique_id = f"{scheduler.entry.entry_id}_watering"
        self._attr_device_info = DeviceInfo(
            identifiers={(DOMAIN, scheduler.entry.entry_id)},
            name=scheduler.entry.data[CONF_NAME],
            manufacturer=NAME,
        )

    @property
    def is_on(self) -> bool:
        """Return True while watering is in progress."""
        return self._scheduler.is_watering

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        """Details about the active watering run."""
        return {
            "started_at": self._scheduler.started_at,
            "finishes_at": self._scheduler.finishes_at,
            "duration": self._scheduler.active_duration,
            "source": self._scheduler.active_source,
            "schedule_id": self._scheduler.active_schedule_id,
            "last_run": self._scheduler.last_run,
            "history": self._scheduler.history,
        }

    async def async_added_to_hass(self) -> None:
        """Subscribe to scheduler updates."""
        self.async_on_remove(
            async_dispatcher_connect(
                self.hass,
                SIGNAL_UPDATE.format(entry_id=self._scheduler.entry.entry_id),
                self._async_handle_update,
            )
        )

    @callback
    def _async_handle_update(self) -> None:
        """Refresh state when the scheduler notifies us."""
        self.async_write_ha_state()
