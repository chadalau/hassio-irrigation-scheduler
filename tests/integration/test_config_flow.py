"""Integration tests for the config flow and options flow."""

from __future__ import annotations

from homeassistant import config_entries
from homeassistant.const import STATE_ON
from homeassistant.core import HomeAssistant
from homeassistant.data_entry_flow import FlowResultType

from custom_components.irrigation_scheduler.config_flow import (
    CLEAR_EC_ENTITY_ID,
    CLEAR_PH_ENTITY_ID,
)
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


async def test_options_flow_keeps_a_sensor_submitted_unchanged(
    hass: HomeAssistant, setup_zone
) -> None:
    """A sensor submitted back unchanged keeps its stored value.

    Companion to test_options_flow_preserves_ph_ec_when_keys_omitted (which
    covers the ABSENT key): whether the field comes back carrying its value or
    not at all, the configured sensor survives the save. The options form
    deliberately cannot CLEAR a sensor -- see the long comment in
    IrrigationSchedulerOptionsFlow.async_step_init for why, and use the card's
    settings dialog (set_zone_options with an empty string) to disable it."""
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


async def _open_options(hass, entry):
    """Open the options flow and return its first form result."""
    return await hass.config_entries.options.async_init(entry.entry_id)


def _base_input(**overrides) -> dict:
    """The always-required numeric fields of the options form."""
    data = {
        CONF_DEFAULT_DURATION: 10,
        CONF_MAX_DURATION: 120,
        CONF_FLOW_RATE_LPH: 0,
        CONF_NUMBER_OF_POTS: 0,
        CONF_RESERVOIR_VOLUME_L: 0,
    }
    data.update(overrides)
    return data


async def _zone_with_sensors(setup_zone, target: str = "switch.zone1"):
    return await setup_zone(
        target_entity_id=target,
        options={
            CONF_ENABLED: True,
            CONF_DEFAULT_DURATION: 600,
            CONF_MAX_DURATION: 7200,
            CONF_PH_ENTITY_ID: "sensor.reservoir_ph",
            CONF_EC_ENTITY_ID: "sensor.reservoir_ec",
            CONF_SCHEDULES: [],
        },
    )


async def test_options_flow_clear_checkbox_removes_the_sensor(
    hass: HomeAssistant, setup_zone
) -> None:
    """The explicit "remove sensor" checkbox is what clears a sensor.

    An absent entity key stays ambiguous and is never read as a removal (see
    test_options_flow_preserves_ph_ec_when_keys_omitted); the checkbox makes
    the removal STATED, which is the only unambiguous way to express it in a
    data_entry_flow form.
    """
    entry = await _zone_with_sensors(setup_zone)

    result = await _open_options(hass, entry)
    result = await hass.config_entries.options.async_configure(
        result["flow_id"],
        user_input=_base_input(
            # The field still carries its suggested_value: ticking "remove"
            # next to it is the normal way a user clears the sensor.
            **{
                CONF_PH_ENTITY_ID: "sensor.reservoir_ph",
                CLEAR_PH_ENTITY_ID: True,
                CONF_EC_ENTITY_ID: "sensor.reservoir_ec",
            }
        ),
    )
    assert result["type"] == FlowResultType.CREATE_ENTRY
    await hass.async_block_till_done()

    assert entry.options[CONF_PH_ENTITY_ID] == ""
    assert scheduler_of(entry).ph_entity_id == ""
    # The untouched EC sensor is not collateral damage.
    assert entry.options[CONF_EC_ENTITY_ID] == "sensor.reservoir_ec"


async def test_options_flow_clear_checkbox_only_offered_when_configured(
    hass: HomeAssistant, setup_zone
) -> None:
    """A zone with no sensors gets no "remove" checkboxes cluttering the form."""
    entry = await setup_zone(
        target_entity_id="switch.zone1",
        options={
            CONF_ENABLED: True,
            CONF_DEFAULT_DURATION: 600,
            CONF_MAX_DURATION: 7200,
            CONF_SCHEDULES: [],
        },
    )
    result = await _open_options(hass, entry)
    keys = {str(key) for key in result["data_schema"].schema}
    assert CLEAR_PH_ENTITY_ID not in keys
    assert CLEAR_EC_ENTITY_ID not in keys

    # ...and a zone WITH a pH sensor is offered exactly that one.
    entry2 = await _zone_with_sensors(setup_zone, target="switch.zone2")
    result = await _open_options(hass, entry2)
    keys = {str(key) for key in result["data_schema"].schema}
    assert CLEAR_PH_ENTITY_ID in keys
    assert CLEAR_EC_ENTITY_ID in keys


async def test_options_flow_rejects_clear_plus_a_different_sensor(
    hass: HomeAssistant, setup_zone
) -> None:
    """Ticking "remove" while picking a DIFFERENT sensor is contradictory.

    Silently honoring one of the two would discard an explicit choice the user
    just made, so the form comes back with an error instead.
    """
    entry = await _zone_with_sensors(setup_zone)

    result = await _open_options(hass, entry)
    result = await hass.config_entries.options.async_configure(
        result["flow_id"],
        user_input=_base_input(
            **{
                CONF_PH_ENTITY_ID: "sensor.another_ph",
                CLEAR_PH_ENTITY_ID: True,
            }
        ),
    )
    assert result["type"] == FlowResultType.FORM
    assert result["errors"] == {"base": "clear_and_select_conflict"}
    # Nothing was written.
    assert entry.options[CONF_PH_ENTITY_ID] == "sensor.reservoir_ph"


async def test_options_flow_replaces_a_sensor_without_the_checkbox(
    hass: HomeAssistant, setup_zone
) -> None:
    """Picking a different sensor (checkbox untouched) simply replaces it."""
    entry = await _zone_with_sensors(setup_zone)

    result = await _open_options(hass, entry)
    result = await hass.config_entries.options.async_configure(
        result["flow_id"],
        user_input=_base_input(**{CONF_PH_ENTITY_ID: "sensor.another_ph"}),
    )
    assert result["type"] == FlowResultType.CREATE_ENTRY
    await hass.async_block_till_done()

    assert entry.options[CONF_PH_ENTITY_ID] == "sensor.another_ph"


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
