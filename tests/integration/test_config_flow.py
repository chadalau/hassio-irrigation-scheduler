"""Integration tests for the config flow and options flow."""

from __future__ import annotations

from homeassistant import config_entries
from homeassistant.const import STATE_ON
from homeassistant.core import HomeAssistant
from homeassistant.data_entry_flow import FlowResultType

from custom_components.irrigation_scheduler.const import (
    CONF_DEFAULT_DURATION,
    CONF_EC_ENTITY_ID,
    CONF_ENABLED,
    CONF_FLOW_RATE_LPH,
    CONF_MAX_DURATION,
    CONF_NAME,
    CONF_NUMBER_OF_POTS,
    CONF_PH_ENTITY_ID,
    CONF_RESERVOIR_VOLUME_L,
    CONF_SCHEDULES,
    CONF_TARGET_ENTITY_ID,
    DEFAULT_FLOW_RATE_LPH,
    DEFAULT_MAX_DURATION,
    DEFAULT_NUMBER_OF_POTS,
    DEFAULT_RESERVOIR_VOLUME_L,
    DOMAIN,
    SERVICE_WATER_NOW,
)

from .conftest import entity_id_of, scheduler_of


async def test_user_step_creates_entry_and_converts_minutes_to_seconds(
    hass: HomeAssistant,
) -> None:
    """5. Step user creates the entry with correct data/options and converts
    minutes to seconds."""
    result = await hass.config_entries.flow.async_init(
        DOMAIN, context={"source": config_entries.SOURCE_USER}
    )
    assert result["type"] == FlowResultType.FORM

    result = await hass.config_entries.flow.async_configure(
        result["flow_id"],
        user_input={
            CONF_NAME: "Garden",
            CONF_TARGET_ENTITY_ID: "switch.zone1",
            CONF_DEFAULT_DURATION: 15,  # minutes
            CONF_FLOW_RATE_LPH: 300,
            CONF_NUMBER_OF_POTS: 12,
            CONF_RESERVOIR_VOLUME_L: 1000,
        },
    )
    assert result["type"] == FlowResultType.CREATE_ENTRY
    assert result["title"] == "Garden"

    entry = hass.config_entries.async_get_entry(result["result"].entry_id)
    assert entry is not None
    assert entry.data[CONF_NAME] == "Garden"
    assert entry.data[CONF_TARGET_ENTITY_ID] == "switch.zone1"

    options = dict(entry.options)
    assert options[CONF_DEFAULT_DURATION] == 15 * 60  # 900 seconds
    assert options[CONF_MAX_DURATION] == DEFAULT_MAX_DURATION
    assert options[CONF_FLOW_RATE_LPH] == 300
    assert options[CONF_NUMBER_OF_POTS] == 12
    assert options[CONF_RESERVOIR_VOLUME_L] == 1000
    assert options[CONF_ENABLED] is True
    assert options[CONF_SCHEDULES] == []


async def test_duplicate_target_aborts_with_already_configured(
    hass: HomeAssistant,
) -> None:
    """6. A second entry for the same target entity aborts."""
    result = await hass.config_entries.flow.async_init(
        DOMAIN, context={"source": config_entries.SOURCE_USER}
    )
    await hass.config_entries.flow.async_configure(
        result["flow_id"],
        user_input={
            CONF_NAME: "Garden",
            CONF_TARGET_ENTITY_ID: "switch.zone1",
            CONF_DEFAULT_DURATION: 15,
            CONF_FLOW_RATE_LPH: DEFAULT_FLOW_RATE_LPH,
            CONF_NUMBER_OF_POTS: DEFAULT_NUMBER_OF_POTS,
            CONF_RESERVOIR_VOLUME_L: DEFAULT_RESERVOIR_VOLUME_L,
        },
    )

    result = await hass.config_entries.flow.async_init(
        DOMAIN, context={"source": config_entries.SOURCE_USER}
    )
    assert result["type"] == FlowResultType.FORM
    result = await hass.config_entries.flow.async_configure(
        result["flow_id"],
        user_input={
            CONF_NAME: "Garden 2",
            CONF_TARGET_ENTITY_ID: "switch.zone1",  # duplicate
            CONF_DEFAULT_DURATION: 15,
            CONF_FLOW_RATE_LPH: DEFAULT_FLOW_RATE_LPH,
            CONF_NUMBER_OF_POTS: DEFAULT_NUMBER_OF_POTS,
            CONF_RESERVOIR_VOLUME_L: DEFAULT_RESERVOIR_VOLUME_L,
        },
    )
    assert result["type"] == FlowResultType.ABORT
    assert result["reason"] == "already_configured"


async def test_options_flow_changes_durations_without_reload_or_interrupt(
    hass: HomeAssistant, setup_zone, mock_homeassistant_services
) -> None:
    """7. Options flow alters durations, does NOT reload the entry and does
    NOT interrupt an active watering run."""
    entry = await setup_zone(
        target_entity_id="switch.zone1",
        name="Garden",
        options={
            CONF_ENABLED: True,
            CONF_DEFAULT_DURATION: 600,
            CONF_MAX_DURATION: 7200,
            CONF_SCHEDULES: [],
        },
    )
    sensor_eid = entity_id_of(hass, entry, "sensor", "next_run")
    assert sensor_eid is not None

    # Start an active watering run through the service.
    await hass.services.async_call(
        DOMAIN, SERVICE_WATER_NOW, {"entity_id": sensor_eid}, blocking=True
    )
    await hass.async_block_till_done()
    scheduler_before = scheduler_of(entry)
    assert scheduler_before.is_watering
    assert hass.states.get("switch.zone1").state == STATE_ON
    # Open the options flow for this entry (handler == entry_id).
    result = await hass.config_entries.options.async_init(
        entry.entry_id, context={"show_advanced_options": False}
    )
    assert result["type"] == FlowResultType.FORM

    result = await hass.config_entries.options.async_configure(
        result["flow_id"],
        user_input={
            CONF_DEFAULT_DURATION: 20,
            CONF_MAX_DURATION: 30,
            CONF_FLOW_RATE_LPH: 500,
            CONF_NUMBER_OF_POTS: 20,
            CONF_RESERVOIR_VOLUME_L: 2000,
        },
    )
    assert result["type"] == FlowResultType.CREATE_ENTRY
    await hass.async_block_till_done()

    # Durations were updated (minutes -> seconds).
    assert entry.options[CONF_DEFAULT_DURATION] == 20 * 60
    assert entry.options[CONF_MAX_DURATION] == 30 * 60
    assert entry.options[CONF_FLOW_RATE_LPH] == 500
    assert entry.options[CONF_NUMBER_OF_POTS] == 20
    assert entry.options[CONF_RESERVOIR_VOLUME_L] == 2000

    # The entry was NOT reloaded: the exact same scheduler instance lives on.
    assert entry.runtime_data is scheduler_before
    assert scheduler_of(entry).is_watering
    assert hass.states.get("switch.zone1").state == STATE_ON


async def test_options_flow_can_clear_a_configured_ph_sensor(
    hass: HomeAssistant, setup_zone
) -> None:
    """REGRESSION: clearing the pH/EC field in the options UI must actually
    remove the sensor.

    The frontend simply OMITS an emptied entity field from user_input, and the
    handler used to fall back to the stored value for a missing key -- making
    "cleared" and "untouched" indistinguishable, so the old entity id
    reappeared on every save and the pH gate could never be disabled from the
    integration's own UI (only through the set_zone_options service).

    Untouched fields come back carrying their suggested_value, which is what
    makes an absent key unambiguous. ``vol.Optional(key, default="")`` cannot
    express this: EntitySelector rejects "".
    """
    entry = await setup_zone(
        target_entity_id="switch.zone1",
        options={
            CONF_ENABLED: True,
            CONF_DEFAULT_DURATION: 600,
            CONF_MAX_DURATION: 7200,
            CONF_PH_ENTITY_ID: "sensor.reservoir_ph",
            CONF_EC_ENTITY_ID: "sensor.reservoir_ec",
            CONF_SCHEDULES: [],
        },
    )

    result = await hass.config_entries.options.async_init(entry.entry_id)
    result = await hass.config_entries.options.async_configure(
        result["flow_id"],
        user_input={
            CONF_DEFAULT_DURATION: 10,
            CONF_MAX_DURATION: 120,
            CONF_FLOW_RATE_LPH: 0,
            CONF_NUMBER_OF_POTS: 0,
            CONF_RESERVOIR_VOLUME_L: 0,
            # Both entity fields emptied by the user -> omitted by the form.
            # The EC one is kept to prove an untouched field is preserved.
            CONF_EC_ENTITY_ID: "sensor.reservoir_ec",
        },
    )
    assert result["type"] == FlowResultType.CREATE_ENTRY
    await hass.async_block_till_done()

    assert entry.options[CONF_PH_ENTITY_ID] == ""
    assert entry.options[CONF_EC_ENTITY_ID] == "sensor.reservoir_ec"
    assert scheduler_of(entry).ph_entity_id == ""


async def test_options_flow_keeps_a_sensor_submitted_unchanged(
    hass: HomeAssistant, setup_zone
) -> None:
    """The other half of the contract: a field left as rendered (its
    suggested_value comes back in user_input) keeps its stored value."""
    entry = await setup_zone(
        target_entity_id="switch.zone1",
        options={
            CONF_ENABLED: True,
            CONF_DEFAULT_DURATION: 600,
            CONF_MAX_DURATION: 7200,
            CONF_PH_ENTITY_ID: "sensor.reservoir_ph",
            CONF_SCHEDULES: [],
        },
    )

    result = await hass.config_entries.options.async_init(entry.entry_id)
    result = await hass.config_entries.options.async_configure(
        result["flow_id"],
        user_input={
            CONF_DEFAULT_DURATION: 10,
            CONF_MAX_DURATION: 120,
            CONF_FLOW_RATE_LPH: 0,
            CONF_NUMBER_OF_POTS: 0,
            CONF_RESERVOIR_VOLUME_L: 0,
            CONF_PH_ENTITY_ID: "sensor.reservoir_ph",
        },
    )
    assert result["type"] == FlowResultType.CREATE_ENTRY
    await hass.async_block_till_done()

    assert entry.options[CONF_PH_ENTITY_ID] == "sensor.reservoir_ph"


async def test_options_flow_opens_with_corrupt_persisted_values(
    hass: HomeAssistant, setup_zone
) -> None:
    entry = await setup_zone(
        target_entity_id="switch.zone1",
        options={
            CONF_ENABLED: True,
            CONF_DEFAULT_DURATION: "bad",
            CONF_MAX_DURATION: None,
            CONF_FLOW_RATE_LPH: "bad",
            CONF_NUMBER_OF_POTS: False,
            CONF_RESERVOIR_VOLUME_L: [],
            CONF_SCHEDULES: [],
        },
    )

    result = await hass.config_entries.options.async_init(entry.entry_id)

    assert result["type"] == FlowResultType.FORM
