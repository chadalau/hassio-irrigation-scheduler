"""Config flow for the Irrigation Scheduler integration."""

from __future__ import annotations

from typing import Any

import voluptuous as vol

from homeassistant import config_entries
from homeassistant.config_entries import ConfigEntry, ConfigFlowResult
from homeassistant.helpers import selector

from .const import (
    CONF_DEFAULT_DURATION,
    CONF_ENABLED,
    CONF_FLOW_RATE_LPH,
    CONF_MAX_DURATION,
    CONF_NAME,
    CONF_NUMBER_OF_POTS,
    CONF_SCHEDULES,
    CONF_TARGET_ENTITY_ID,
    DEFAULT_DEFAULT_DURATION,
    DEFAULT_FLOW_RATE_LPH,
    DEFAULT_MAX_DURATION,
    DEFAULT_NUMBER_OF_POTS,
    DOMAIN,
)

DEFAULT_DURATION_MINUTES = DEFAULT_DEFAULT_DURATION // 60
MAX_DURATION_MINUTES = DEFAULT_MAX_DURATION // 60

_TARGET_DOMAINS = ["switch", "valve", "input_boolean", "light"]


class IrrigationSchedulerConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    """Handle a config flow for Irrigation Scheduler."""

    VERSION = 1

    async def async_step_user(
        self, user_input: dict[str, Any] | None = None
    ) -> ConfigFlowResult:
        """Handle the initial step (one config entry == one irrigation zone)."""
        errors: dict[str, str] = {}

        if user_input is not None:
            target_entity_id: str = user_input[CONF_TARGET_ENTITY_ID]

            # One zone per target entity.
            await self.async_set_unique_id(target_entity_id)
            self._abort_if_unique_id_configured()

            default_duration = int(user_input[CONF_DEFAULT_DURATION]) * 60
            flow_rate = int(user_input[CONF_FLOW_RATE_LPH])
            number_of_pots = int(user_input[CONF_NUMBER_OF_POTS])

            return self.async_create_entry(
                title=user_input[CONF_NAME],
                data={
                    CONF_NAME: user_input[CONF_NAME],
                    CONF_TARGET_ENTITY_ID: target_entity_id,
                },
                options={
                    CONF_ENABLED: True,
                    CONF_DEFAULT_DURATION: default_duration,
                    CONF_MAX_DURATION: DEFAULT_MAX_DURATION,
                    CONF_FLOW_RATE_LPH: flow_rate,
                    CONF_NUMBER_OF_POTS: number_of_pots,
                    CONF_SCHEDULES: [],
                },
            )

        return self.async_show_form(
            step_id="user",
            data_schema=vol.Schema(
                {
                    vol.Required(CONF_NAME, default="Garden"): selector.TextSelector(),
                    vol.Required(CONF_TARGET_ENTITY_ID): selector.EntitySelector(
                        selector.EntitySelectorConfig(domain=_TARGET_DOMAINS)
                    ),
                    vol.Required(
                        CONF_DEFAULT_DURATION, default=DEFAULT_DURATION_MINUTES
                    ): selector.NumberSelector(
                        selector.NumberSelectorConfig(
                            mode=selector.NumberSelectorMode.BOX,
                            min=1,
                            max=MAX_DURATION_MINUTES,
                            unit_of_measurement="min",
                        )
                    ),
                    vol.Optional(
                        CONF_FLOW_RATE_LPH, default=DEFAULT_FLOW_RATE_LPH
                    ): selector.NumberSelector(
                        selector.NumberSelectorConfig(
                            mode=selector.NumberSelectorMode.BOX,
                            min=0,
                            max=100000,
                            unit_of_measurement="L/h",
                        )
                    ),
                    vol.Optional(
                        CONF_NUMBER_OF_POTS, default=DEFAULT_NUMBER_OF_POTS
                    ): selector.NumberSelector(
                        selector.NumberSelectorConfig(
                            mode=selector.NumberSelectorMode.BOX,
                            min=0,
                            max=100000,
                        )
                    ),
                }
            ),
            errors=errors,
        )

    @staticmethod
    def async_get_options_flow(
        config_entry: ConfigEntry,
    ) -> IrrigationSchedulerOptionsFlow:
        """Get the options flow for this handler."""
        return IrrigationSchedulerOptionsFlow()


class IrrigationSchedulerOptionsFlow(config_entries.OptionsFlow):
    """Handle an options flow for Irrigation Scheduler (durations only).

    The framework exposes the linked entry through ``self.config_entry`` (no
    entry is passed to ``__init__`` anymore).
    """

    async def async_step_init(
        self, user_input: dict[str, Any] | None = None
    ) -> ConfigFlowResult:
        """Manage durations for the zone."""
        errors: dict[str, str] = {}

        current_default_min = (
            int(
                self.config_entry.options.get(
                    CONF_DEFAULT_DURATION, DEFAULT_DEFAULT_DURATION
                )
            )
            // 60
        )
        current_max_min = (
            int(self.config_entry.options.get(CONF_MAX_DURATION, DEFAULT_MAX_DURATION))
            // 60
        )
        current_flow = int(
            self.config_entry.options.get(
                CONF_FLOW_RATE_LPH, DEFAULT_FLOW_RATE_LPH
            )
        )
        current_pots = int(
            self.config_entry.options.get(
                CONF_NUMBER_OF_POTS, DEFAULT_NUMBER_OF_POTS
            )
        )

        if user_input is not None:
            default_min = int(user_input[CONF_DEFAULT_DURATION])
            max_min = int(user_input[CONF_MAX_DURATION])
            if default_min > max_min:
                errors["base"] = "default_duration_too_high"
            else:
                new_options = {
                    **dict(self.config_entry.options),
                    CONF_DEFAULT_DURATION: default_min * 60,
                    CONF_MAX_DURATION: max_min * 60,
                    CONF_FLOW_RATE_LPH: int(user_input[CONF_FLOW_RATE_LPH]),
                    CONF_NUMBER_OF_POTS: int(user_input[CONF_NUMBER_OF_POTS]),
                }
                # Saving options MUST NOT reload the entry (the update listener
                # only recalculates the next firing).
                return self.async_create_entry(title="", data=new_options)

        return self.async_show_form(
            step_id="init",
            data_schema=vol.Schema(
                {
                    vol.Required(
                        CONF_DEFAULT_DURATION, default=current_default_min
                    ): selector.NumberSelector(
                        selector.NumberSelectorConfig(
                            mode=selector.NumberSelectorMode.BOX,
                            min=1,
                            max=1440,
                            unit_of_measurement="min",
                        )
                    ),
                    vol.Required(
                        CONF_MAX_DURATION, default=current_max_min
                    ): selector.NumberSelector(
                        selector.NumberSelectorConfig(
                            mode=selector.NumberSelectorMode.BOX,
                            min=1,
                            max=1440,
                            unit_of_measurement="min",
                        )
                    ),
                    vol.Optional(
                        CONF_FLOW_RATE_LPH, default=current_flow
                    ): selector.NumberSelector(
                        selector.NumberSelectorConfig(
                            mode=selector.NumberSelectorMode.BOX,
                            min=0,
                            max=100000,
                            unit_of_measurement="L/h",
                        )
                    ),
                    vol.Optional(
                        CONF_NUMBER_OF_POTS, default=current_pots
                    ): selector.NumberSelector(
                        selector.NumberSelectorConfig(
                            mode=selector.NumberSelectorMode.BOX,
                            min=0,
                            max=100000,
                        )
                    ),
                }
            ),
            errors=errors,
        )
