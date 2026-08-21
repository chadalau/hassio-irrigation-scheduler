"""Config flow for the Irrigation Scheduler integration."""

from __future__ import annotations

import math
from typing import Any

import voluptuous as vol
from homeassistant import config_entries
from homeassistant.config_entries import ConfigEntry, ConfigFlowResult
from homeassistant.helpers import selector

from .const import (
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
    CONF_RESERVOIR_VOLUME_L,
    CONF_SCHEDULES,
    CONF_TARGET_ENTITY_ID,
    DEFAULT_DEFAULT_DURATION,
    DEFAULT_EC_ENTITY_ID,
    DEFAULT_EC_ENTITY_ID_2,
    DEFAULT_FLOW_RATE_LPH,
    DEFAULT_MAX_DURATION,
    DEFAULT_NUMBER_OF_POTS,
    DEFAULT_PH_ENTITY_ID,
    DEFAULT_PH_ENTITY_ID_2,
    DEFAULT_PH_MAX,
    DEFAULT_PH_MAX_2,
    DEFAULT_PH_MIN,
    DEFAULT_PH_MIN_2,
    DEFAULT_RESERVOIR_VOLUME_L,
    DOMAIN,
    PH_SCALE_MAX,
    PH_SCALE_MIN,
)

DEFAULT_DURATION_MINUTES = DEFAULT_DEFAULT_DURATION // 60
MAX_DURATION_MINUTES = DEFAULT_MAX_DURATION // 60

_TARGET_DOMAINS = ["switch", "valve", "input_boolean", "light"]

# Transient options-form fields (never persisted): an explicit "remove this
# sensor" checkbox next to each configured pH/EC entity.
#
# They exist because an ABSENT entity key in ``user_input`` is ambiguous --
# the frontend omits the field both when the user cleared it and when it was
# never touched -- and resolving that ambiguity by guessing is exactly what
# must not happen here: guessing "cleared" would silently disable the pH gate
# on an ordinary save and let a zone water without ever checking pH (see the
# long comment in async_step_init, and
# test_options_flow_preserves_ph_ec_when_keys_omitted). A checkbox makes the
# removal STATED instead of inferred, which is the only unambiguous way to
# express it in a data_entry_flow form. ``vol.Optional(key, default="")``
# cannot: EntitySelector rejects "".
#
# Each one is only rendered when that sensor is actually configured, so a zone
# with no sensors sees no extra checkboxes at all.
CLEAR_PH_ENTITY_ID = "clear_ph_entity_id"
CLEAR_EC_ENTITY_ID = "clear_ec_entity_id"
CLEAR_PH_ENTITY_ID_2 = "clear_ph_entity_id_2"
CLEAR_EC_ENTITY_ID_2 = "clear_ec_entity_id_2"


def _safe_int(value: Any, default: int, *, minimum: int = 0) -> int:
    """Coerce persisted options without letting a corrupt entry break UI."""
    try:
        parsed = int(value)
    except (TypeError, ValueError, OverflowError):
        return default
    return parsed if not isinstance(value, bool) and parsed >= minimum else default


def _safe_float(value: Any, default: float) -> float:
    """Return a finite persisted float, falling back for corrupt values."""
    try:
        parsed = float(value)
    except (TypeError, ValueError, OverflowError):
        return default
    return parsed if math.isfinite(parsed) else default


def _clear_field(key: str, current: str) -> dict[Any, Any]:
    """A "remove this sensor" checkbox, or nothing when none is configured.

    Returned as a 0-or-1 entry dict so it can be spliced into the options
    schema right after the entity field it belongs to (``**_clear_field(...)``)
    instead of piling every checkbox at the bottom of the form.
    """
    if not current:
        return {}
    return {vol.Optional(key, default=False): selector.BooleanSelector()}


def _resolve_sensor(
    user_input: dict[str, Any], key: str, clear_key: str, current: str
) -> tuple[str, bool]:
    """Resolve one optional sensor field to ``(value, conflict)``.

    Three outcomes, in the order they are checked:

    - the "remove" checkbox was ticked -> ``""`` (the explicit "no sensor /
      gate disabled" value, same as the set_zone_options service uses);
    - an entity came back in the payload -> that entity (a replacement, or the
      unchanged suggested_value echoed back);
    - the key is absent -> ``current``, i.e. leave it alone. An absent key is
      NOT read as a removal; that is what the checkbox is for.

    ``conflict`` flags the one combination that cannot be honored coherently:
    the checkbox ticked while a DIFFERENT entity was picked in the same save.
    Ticking it while the field still shows the configured entity is the normal
    case (the form renders it via ``suggested_value``), not a conflict.
    """
    submitted = user_input.get(key)
    if user_input.get(clear_key):
        if isinstance(submitted, str) and submitted and submitted != current:
            return current, True
        return "", False
    if isinstance(submitted, str) and submitted:
        return submitted, False
    return current, False


class IrrigationSchedulerConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    """Handle a config flow for Irrigation Scheduler."""

    VERSION = 1

    async def async_step_user(
        self, user_input: dict[str, Any] | None = None
    ) -> ConfigFlowResult:
        """Handle the initial step (one config entry == one irrigation zone)."""
        errors: dict[str, str] = {}

        if user_input is not None:
            ph_min = float(user_input.get(CONF_PH_MIN, DEFAULT_PH_MIN))
            ph_max = float(user_input.get(CONF_PH_MAX, DEFAULT_PH_MAX))
            ph_min_2 = float(user_input.get(CONF_PH_MIN_2, DEFAULT_PH_MIN_2))
            ph_max_2 = float(user_input.get(CONF_PH_MAX_2, DEFAULT_PH_MAX_2))
            if ph_min > ph_max:
                errors["base"] = "ph_min_too_high"
            elif ph_min_2 > ph_max_2:
                errors["base"] = "ph_min_too_high_2"
            else:
                target_entity_id: str = user_input[CONF_TARGET_ENTITY_ID]

                # One zone per target entity.
                await self.async_set_unique_id(target_entity_id)
                self._abort_if_unique_id_configured()

                default_duration = int(user_input[CONF_DEFAULT_DURATION]) * 60
                flow_rate = int(user_input[CONF_FLOW_RATE_LPH])
                number_of_pots = int(user_input[CONF_NUMBER_OF_POTS])
                reservoir_volume = int(user_input[CONF_RESERVOIR_VOLUME_L])
                ph_entity_id = user_input.get(CONF_PH_ENTITY_ID) or DEFAULT_PH_ENTITY_ID
                ec_entity_id = user_input.get(CONF_EC_ENTITY_ID) or DEFAULT_EC_ENTITY_ID
                ph_entity_id_2 = (
                    user_input.get(CONF_PH_ENTITY_ID_2) or DEFAULT_PH_ENTITY_ID_2
                )
                ec_entity_id_2 = (
                    user_input.get(CONF_EC_ENTITY_ID_2) or DEFAULT_EC_ENTITY_ID_2
                )

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
                        CONF_RESERVOIR_VOLUME_L: reservoir_volume,
                        CONF_PH_ENTITY_ID: ph_entity_id,
                        CONF_PH_MIN: ph_min,
                        CONF_PH_MAX: ph_max,
                        CONF_EC_ENTITY_ID: ec_entity_id,
                        CONF_PH_ENTITY_ID_2: ph_entity_id_2,
                        CONF_PH_MIN_2: ph_min_2,
                        CONF_PH_MAX_2: ph_max_2,
                        CONF_EC_ENTITY_ID_2: ec_entity_id_2,
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
                    vol.Optional(
                        CONF_RESERVOIR_VOLUME_L, default=DEFAULT_RESERVOIR_VOLUME_L
                    ): selector.NumberSelector(
                        selector.NumberSelectorConfig(
                            mode=selector.NumberSelectorMode.BOX,
                            min=0,
                            max=100000,
                            unit_of_measurement="L",
                        )
                    ),
                    vol.Optional(CONF_PH_ENTITY_ID): selector.EntitySelector(
                        selector.EntitySelectorConfig(domain="sensor")
                    ),
                    vol.Optional(
                        CONF_PH_MIN, default=DEFAULT_PH_MIN
                    ): selector.NumberSelector(
                        selector.NumberSelectorConfig(
                            mode=selector.NumberSelectorMode.BOX,
                            min=PH_SCALE_MIN,
                            max=PH_SCALE_MAX,
                            step=0.1,
                        )
                    ),
                    vol.Optional(
                        CONF_PH_MAX, default=DEFAULT_PH_MAX
                    ): selector.NumberSelector(
                        selector.NumberSelectorConfig(
                            mode=selector.NumberSelectorMode.BOX,
                            min=PH_SCALE_MIN,
                            max=PH_SCALE_MAX,
                            step=0.1,
                        )
                    ),
                    vol.Optional(CONF_EC_ENTITY_ID): selector.EntitySelector(
                        selector.EntitySelectorConfig(domain="sensor")
                    ),
                    vol.Optional(CONF_PH_ENTITY_ID_2): selector.EntitySelector(
                        selector.EntitySelectorConfig(domain="sensor")
                    ),
                    vol.Optional(
                        CONF_PH_MIN_2, default=DEFAULT_PH_MIN_2
                    ): selector.NumberSelector(
                        selector.NumberSelectorConfig(
                            mode=selector.NumberSelectorMode.BOX,
                            min=PH_SCALE_MIN,
                            max=PH_SCALE_MAX,
                            step=0.1,
                        )
                    ),
                    vol.Optional(
                        CONF_PH_MAX_2, default=DEFAULT_PH_MAX_2
                    ): selector.NumberSelector(
                        selector.NumberSelectorConfig(
                            mode=selector.NumberSelectorMode.BOX,
                            min=PH_SCALE_MIN,
                            max=PH_SCALE_MAX,
                            step=0.1,
                        )
                    ),
                    vol.Optional(CONF_EC_ENTITY_ID_2): selector.EntitySelector(
                        selector.EntitySelectorConfig(domain="sensor")
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

        current_default_min = max(
            1,
            _safe_int(
                self.config_entry.options.get(
                    CONF_DEFAULT_DURATION, DEFAULT_DEFAULT_DURATION
                ),
                DEFAULT_DEFAULT_DURATION,
                minimum=1,
            )
            // 60,
        )
        current_max_min = max(
            1,
            _safe_int(
                self.config_entry.options.get(CONF_MAX_DURATION, DEFAULT_MAX_DURATION),
                DEFAULT_MAX_DURATION,
                minimum=1,
            )
            // 60,
        )
        current_flow = _safe_int(
            self.config_entry.options.get(
                CONF_FLOW_RATE_LPH, DEFAULT_FLOW_RATE_LPH
            ), DEFAULT_FLOW_RATE_LPH
        )
        current_pots = _safe_int(
            self.config_entry.options.get(
                CONF_NUMBER_OF_POTS, DEFAULT_NUMBER_OF_POTS
            ), DEFAULT_NUMBER_OF_POTS
        )
        current_reservoir = _safe_int(
            self.config_entry.options.get(
                CONF_RESERVOIR_VOLUME_L, DEFAULT_RESERVOIR_VOLUME_L
            ), DEFAULT_RESERVOIR_VOLUME_L
        )
        current_ph_entity = self.config_entry.options.get(
            CONF_PH_ENTITY_ID, DEFAULT_PH_ENTITY_ID
        )
        current_ph_min = _safe_float(
            self.config_entry.options.get(CONF_PH_MIN, DEFAULT_PH_MIN), DEFAULT_PH_MIN
        )
        current_ph_max = _safe_float(
            self.config_entry.options.get(CONF_PH_MAX, DEFAULT_PH_MAX), DEFAULT_PH_MAX
        )
        current_ec_entity = self.config_entry.options.get(
            CONF_EC_ENTITY_ID, DEFAULT_EC_ENTITY_ID
        )
        current_ph_entity_2 = self.config_entry.options.get(
            CONF_PH_ENTITY_ID_2, DEFAULT_PH_ENTITY_ID_2
        )
        current_ph_min_2 = _safe_float(
            self.config_entry.options.get(CONF_PH_MIN_2, DEFAULT_PH_MIN_2), DEFAULT_PH_MIN_2
        )
        current_ph_max_2 = _safe_float(
            self.config_entry.options.get(CONF_PH_MAX_2, DEFAULT_PH_MAX_2), DEFAULT_PH_MAX_2
        )
        current_ec_entity_2 = self.config_entry.options.get(
            CONF_EC_ENTITY_ID_2, DEFAULT_EC_ENTITY_ID_2
        )

        if user_input is not None:
            default_min = int(user_input[CONF_DEFAULT_DURATION])
            max_min = int(user_input[CONF_MAX_DURATION])
            ph_min = float(user_input.get(CONF_PH_MIN, DEFAULT_PH_MIN))
            ph_max = float(user_input.get(CONF_PH_MAX, DEFAULT_PH_MAX))
            ph_min_2 = float(user_input.get(CONF_PH_MIN_2, DEFAULT_PH_MIN_2))
            ph_max_2 = float(user_input.get(CONF_PH_MAX_2, DEFAULT_PH_MAX_2))
            # Each sensor resolves to one of: keep (the common case), replace
            # (a different entity came back in the payload) or clear (the
            # "remove" checkbox was ticked). ``_resolve_sensor`` also reports
            # the contradictory combination -- remove ticked AND a different
            # entity picked in the same save -- which is surfaced as an error
            # instead of silently honoring one of the two.
            ph_entity, ph_conflict = _resolve_sensor(
                user_input, CONF_PH_ENTITY_ID, CLEAR_PH_ENTITY_ID, current_ph_entity
            )
            ec_entity, ec_conflict = _resolve_sensor(
                user_input, CONF_EC_ENTITY_ID, CLEAR_EC_ENTITY_ID, current_ec_entity
            )
            ph_entity_2, ph_conflict_2 = _resolve_sensor(
                user_input,
                CONF_PH_ENTITY_ID_2,
                CLEAR_PH_ENTITY_ID_2,
                current_ph_entity_2,
            )
            ec_entity_2, ec_conflict_2 = _resolve_sensor(
                user_input,
                CONF_EC_ENTITY_ID_2,
                CLEAR_EC_ENTITY_ID_2,
                current_ec_entity_2,
            )

            if default_min > max_min:
                errors["base"] = "default_duration_too_high"
            elif ph_min > ph_max:
                errors["base"] = "ph_min_too_high"
            elif ph_min_2 > ph_max_2:
                errors["base"] = "ph_min_too_high_2"
            elif ph_conflict or ec_conflict or ph_conflict_2 or ec_conflict_2:
                errors["base"] = "clear_and_select_conflict"
            else:
                new_options = {
                    **dict(self.config_entry.options),
                    CONF_DEFAULT_DURATION: default_min * 60,
                    CONF_MAX_DURATION: max_min * 60,
                    CONF_FLOW_RATE_LPH: int(user_input[CONF_FLOW_RATE_LPH]),
                    CONF_NUMBER_OF_POTS: int(user_input[CONF_NUMBER_OF_POTS]),
                    CONF_RESERVOIR_VOLUME_L: int(
                        user_input[CONF_RESERVOIR_VOLUME_L]
                    ),
                    # Resolved by _resolve_sensor above: an ABSENT key always
                    # preserves what is already configured, and removal is
                    # expressed by the explicit "remove" checkbox, never
                    # inferred from the absence.
                    #
                    # An absent key is genuinely AMBIGUOUS -- the frontend
                    # omits an entity field both when the user cleared it and
                    # when it was never touched -- and reading it as "cleared"
                    # would silently DISABLE the pH gate on an ordinary save,
                    # letting a zone water without ever checking pH. That is a
                    # safety-relevant regression nobody notices until the
                    # warning badge stops appearing, which is why the
                    # conservative reading is pinned by
                    # test_options_flow_preserves_ph_ec_when_keys_omitted
                    # (finding A1 of the 2026-08-12 review round) and why the
                    # checkbox exists instead.
                    CONF_PH_ENTITY_ID: ph_entity,
                    CONF_PH_MIN: ph_min,
                    CONF_PH_MAX: ph_max,
                    CONF_EC_ENTITY_ID: ec_entity,
                    CONF_PH_ENTITY_ID_2: ph_entity_2,
                    CONF_PH_MIN_2: ph_min_2,
                    CONF_PH_MAX_2: ph_max_2,
                    CONF_EC_ENTITY_ID_2: ec_entity_2,
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
                    vol.Optional(
                        CONF_RESERVOIR_VOLUME_L, default=current_reservoir
                    ): selector.NumberSelector(
                        selector.NumberSelectorConfig(
                            mode=selector.NumberSelectorMode.BOX,
                            min=0,
                            max=100000,
                            unit_of_measurement="L",
                        )
                    ),
                    vol.Optional(
                        CONF_PH_ENTITY_ID,
                        description={"suggested_value": current_ph_entity or None},
                    ): selector.EntitySelector(
                        selector.EntitySelectorConfig(domain="sensor")
                    ),
                    **_clear_field(CLEAR_PH_ENTITY_ID, current_ph_entity),
                    vol.Optional(
                        CONF_PH_MIN, default=current_ph_min
                    ): selector.NumberSelector(
                        selector.NumberSelectorConfig(
                            mode=selector.NumberSelectorMode.BOX,
                            min=PH_SCALE_MIN,
                            max=PH_SCALE_MAX,
                            step=0.1,
                        )
                    ),
                    vol.Optional(
                        CONF_PH_MAX, default=current_ph_max
                    ): selector.NumberSelector(
                        selector.NumberSelectorConfig(
                            mode=selector.NumberSelectorMode.BOX,
                            min=PH_SCALE_MIN,
                            max=PH_SCALE_MAX,
                            step=0.1,
                        )
                    ),
                    vol.Optional(
                        CONF_EC_ENTITY_ID,
                        description={"suggested_value": current_ec_entity or None},
                    ): selector.EntitySelector(
                        selector.EntitySelectorConfig(domain="sensor")
                    ),
                    **_clear_field(CLEAR_EC_ENTITY_ID, current_ec_entity),
                    vol.Optional(
                        CONF_PH_ENTITY_ID_2,
                        description={"suggested_value": current_ph_entity_2 or None},
                    ): selector.EntitySelector(
                        selector.EntitySelectorConfig(domain="sensor")
                    ),
                    **_clear_field(CLEAR_PH_ENTITY_ID_2, current_ph_entity_2),
                    vol.Optional(
                        CONF_PH_MIN_2, default=current_ph_min_2
                    ): selector.NumberSelector(
                        selector.NumberSelectorConfig(
                            mode=selector.NumberSelectorMode.BOX,
                            min=PH_SCALE_MIN,
                            max=PH_SCALE_MAX,
                            step=0.1,
                        )
                    ),
                    vol.Optional(
                        CONF_PH_MAX_2, default=current_ph_max_2
                    ): selector.NumberSelector(
                        selector.NumberSelectorConfig(
                            mode=selector.NumberSelectorMode.BOX,
                            min=PH_SCALE_MIN,
                            max=PH_SCALE_MAX,
                            step=0.1,
                        )
                    ),
                    vol.Optional(
                        CONF_EC_ENTITY_ID_2,
                        description={"suggested_value": current_ec_entity_2 or None},
                    ): selector.EntitySelector(
                        selector.EntitySelectorConfig(domain="sensor")
                    ),
                    **_clear_field(CLEAR_EC_ENTITY_ID_2, current_ec_entity_2),
                }
            ),
            errors=errors,
        )
