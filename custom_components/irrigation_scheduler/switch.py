"""Switch platform: enables/disables the whole schedule for a zone."""

from __future__ import annotations

from typing import Any

from homeassistant.components.switch import SwitchDeviceClass, SwitchEntity
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
    """Set up the schedule-enabled switch for the zone."""
    scheduler: IrrigationScheduler = entry.runtime_data
    async_add_entities([IrrigationSchedulerSwitch(scheduler)])


class IrrigationSchedulerSwitch(SwitchEntity):
    """Switch that toggles schedule execution for the zone."""

    _attr_has_entity_name = True
    _attr_translation_key = "schedule_enabled"
    _attr_icon = "mdi:calendar-clock"
    _attr_should_poll = False
    _attr_device_class = SwitchDeviceClass.SWITCH

    def __init__(self, scheduler: IrrigationScheduler) -> None:
        """Initialize the switch."""
        self._scheduler = scheduler
        self._attr_unique_id = f"{scheduler.entry.entry_id}_schedule_enabled"
        self._attr_device_info = DeviceInfo(
            identifiers={(DOMAIN, scheduler.entry.entry_id)},
            name=scheduler.entry.data[CONF_NAME],
            manufacturer=NAME,
        )

    @property
    def is_on(self) -> bool:
        """Return True if scheduling is enabled."""
        return self._scheduler.enabled

    async def async_turn_on(self, **kwargs: Any) -> None:
        """Enable scheduling."""
        await self._scheduler.async_set_enabled(True)

    async def async_turn_off(self, **kwargs: Any) -> None:
        """Disable scheduling."""
        await self._scheduler.async_set_enabled(False)

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
