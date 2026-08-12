"""Integration tests for the config flow and options flow."""

from __future__ import annotations

from homeassistant import config_entries
from homeassistant.const import STATE_ON
from homeassistant.core import HomeAssistant
from homeassistant.data_entry_flow import FlowResultType

from custom_components.irrigation_scheduler.const import (
    CONF_DEFAULT_DURATION,
    CONF_ENABLED,
    CONF_MAX_DURATION,
    CONF_NAME,
    CONF_SCHEDULES,
    CONF_TARGET_ENTITY_ID,
    DEFAULT_MAX_DURATION,
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
        user_input={CONF_DEFAULT_DURATION: 20, CONF_MAX_DURATION: 30},
    )
    assert result["type"] == FlowResultType.CREATE_ENTRY
    await hass.async_block_till_done()

    # Durations were updated (minutes -> seconds).
    assert entry.options[CONF_DEFAULT_DURATION] == 20 * 60
    assert entry.options[CONF_MAX_DURATION] == 30 * 60

    # The entry was NOT reloaded: the exact same scheduler instance lives on.
    assert entry.runtime_data is scheduler_before
    assert scheduler_of(entry).is_watering
    assert hass.states.get("switch.zone1").state == STATE_ON
