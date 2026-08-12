"""Integration tests for entry setup/teardown.

Runs under pytest-homeassistant-custom-component (HA test venv only).
"""

from __future__ import annotations

import pytest

from homeassistant.const import STATE_ON, STATE_UNAVAILABLE, Platform
from homeassistant.core import HomeAssistant
from homeassistant.helpers import device_registry as dr, entity_registry as er

from custom_components.irrigation_scheduler.const import (
    CONF_DEFAULT_DURATION,
    CONF_ENABLED,
    CONF_MAX_DURATION,
    CONF_SCHEDULES,
    DEFAULT_DEFAULT_DURATION,
    DEFAULT_MAX_DURATION,
    DOMAIN,
    SERVICE_ADD_SCHEDULE,
    SERVICE_REMOVE_SCHEDULE,
    SERVICE_SET_SCHEDULES,
    SERVICE_STOP,
    SERVICE_UPDATE_SCHEDULE,
    SERVICE_WATER_NOW,
)

from .conftest import entity_id_of, scheduler_of

ALL_SERVICES = (
    SERVICE_WATER_NOW,
    SERVICE_STOP,
    SERVICE_ADD_SCHEDULE,
    SERVICE_UPDATE_SCHEDULE,
    SERVICE_REMOVE_SCHEDULE,
    SERVICE_SET_SCHEDULES,
)


def _assert_services_registered(hass: HomeAssistant, expected: bool) -> None:
    for service in ALL_SERVICES:
        assert hass.services.has_service(DOMAIN, service) is expected, service


async def test_entry_creates_three_entities_on_the_same_device(
    hass: HomeAssistant,
    setup_zone,
    entity_registry: er.EntityRegistry,
    device_registry: dr.DeviceRegistry,
) -> None:
    """1. Entry loads; the 3 entities exist with the expected unique_ids on the
    SAME device."""
    entry = await setup_zone(target_entity_id="switch.zone1", name="Garden")

    sensor_eid = entity_id_of(hass, entry, "sensor", "next_run")
    switch_eid = entity_id_of(hass, entry, "switch", "schedule_enabled")
    binary_eid = entity_id_of(hass, entry, "binary_sensor", "watering")

    assert sensor_eid and hass.states.get(sensor_eid) is not None
    assert switch_eid and hass.states.get(switch_eid) is not None
    assert binary_eid and hass.states.get(binary_eid) is not None

    sensor_reg = entity_registry.async_get(sensor_eid)
    switch_reg = entity_registry.async_get(switch_eid)
    binary_reg = entity_registry.async_get(binary_eid)
    assert sensor_reg is not None and switch_reg is not None and binary_reg is not None

    # All three live on the SAME device.
    assert sensor_reg.device_id is not None
    assert sensor_reg.device_id == switch_reg.device_id == binary_reg.device_id

    device = device_registry.async_get(sensor_reg.device_id)
    assert device is not None
    assert (DOMAIN, entry.entry_id) in device.identifiers


async def test_sensor_attribute_contract_has_all_keys_and_sibling_ids(
    hass: HomeAssistant, setup_zone
) -> None:
    """2. Sensor attribute contract: all 6 keys present and the sibling
    entity ids are NOT null after start (regression of item 7)."""
    entry = await setup_zone(target_entity_id="switch.zone1", name="Garden")
    await hass.async_block_till_done()

    sensor_eid = entity_id_of(hass, entry, "sensor", "next_run")
    assert sensor_eid is not None
    state = hass.states.get(sensor_eid)
    assert state is not None

    expected_keys = {
        "schedules",
        "target_entity_id",
        "default_duration",
        "max_duration",
        "flow_rate_lph",
        "number_of_pots",
        "reservoir_volume_l",
        "switch_entity_id",
        "binary_sensor_entity_id",
    }
    assert expected_keys <= set(state.attributes)

    switch_eid = entity_id_of(hass, entry, "switch", "schedule_enabled")
    binary_eid = entity_id_of(hass, entry, "binary_sensor", "watering")
    assert state.attributes["switch_entity_id"] == switch_eid
    assert state.attributes["binary_sensor_entity_id"] == binary_eid
    assert state.attributes["target_entity_id"] == "switch.zone1"
    assert state.attributes["default_duration"] == 600
    assert state.attributes["max_duration"] == 7200
    assert state.attributes["flow_rate_lph"] == 0
    assert state.attributes["number_of_pots"] == 0
    assert state.attributes["reservoir_volume_l"] == 0
    assert state.attributes["schedules"] == []


async def test_unload_removes_entities_and_services_only_with_last_entry(
    hass: HomeAssistant, setup_zone
) -> None:
    """3. Unload removes the entities and unregisters the 6 services when it
    is the LAST entry; with 2 entries unloading one does NOT unregister."""
    entry1 = await setup_zone(target_entity_id="switch.zone1", name="Zone 1")
    _assert_services_registered(hass, expected=True)

    entry2 = await setup_zone(target_entity_id="switch.zone2", name="Zone 2")
    _assert_services_registered(hass, expected=True)

    sensor1 = entity_id_of(hass, entry1, "sensor", "next_run")
    assert sensor1 is not None and hass.states.get(sensor1) is not None

    # Unload the first entry: entities go away, services must SURVIVE. HA
    # leaves a restored "unavailable" placeholder in the state machine for
    # entities that stay registered, so the state may be unavailable/None.
    assert await hass.config_entries.async_unload(entry1.entry_id)
    await hass.async_block_till_done()
    unloaded_state = hass.states.get(sensor1)
    assert unloaded_state is None or unloaded_state.state == STATE_UNAVAILABLE
    _assert_services_registered(hass, expected=True)

    # Unload the last entry: services must be removed too.
    assert await hass.config_entries.async_unload(entry2.entry_id)
    await hass.async_block_till_done()
    _assert_services_registered(hass, expected=False)


async def test_two_zones_watering_at_once_keep_both_store_entries(
    hass: HomeAssistant, setup_zone, mock_homeassistant_services
) -> None:
    """4. Two zones watering at the same time: the shared store keeps BOTH
    entries (regression of the clobber bug, item 3)."""
    entry1 = await setup_zone(target_entity_id="switch.zone1", name="Zone 1")
    entry2 = await setup_zone(target_entity_id="switch.zone2", name="Zone 2")

    for entry in (entry1, entry2):
        sensor_eid = entity_id_of(hass, entry, "sensor", "next_run")
        assert sensor_eid is not None
        await hass.services.async_call(
            DOMAIN,
            SERVICE_WATER_NOW,
            {"entity_id": sensor_eid},
            blocking=True,
        )
    await hass.async_block_till_done()

    # Both zones are watering concurrently.
    assert scheduler_of(entry1).is_watering
    assert scheduler_of(entry2).is_watering
    assert hass.states.get("switch.zone1").state == STATE_ON
    assert hass.states.get("switch.zone2").state == STATE_ON

    # The shared store holds BOTH entries.
    store = hass.data[DOMAIN]["store"]
    data = await store.async_load()
    assert set(data["entries"]) == {entry1.entry_id, entry2.entry_id}

    # Cleanup: unload both entries (finishes the runs and clears the store).
    assert await hass.config_entries.async_unload(entry1.entry_id)
    assert await hass.config_entries.async_unload(entry2.entry_id)
    data = await store.async_load()
    assert data["entries"] == {}


async def test_corrupt_duration_options_fall_back_to_defaults(
    hass: HomeAssistant, setup_zone, mock_homeassistant_services
) -> None:
    """REGRESSION: corrupted duration/schedule options never crash the sensor
    attributes nor water_now.

    ``max_duration="abc"`` must fall back to the default (with a warning)
    instead of raising ValueError inside ``extra_state_attributes``, malformed
    schedule items are filtered out, and ``water_now`` still uses the default
    duration.
    """
    valid_schedule = {
        "id": "s1",
        "time": "07:00:00",
        "days": [0],
        "duration": 900,
        "enabled": True,
    }
    entry = await setup_zone(
        target_entity_id="switch.zone1",
        name="Garden",
        options={
            CONF_ENABLED: True,
            CONF_DEFAULT_DURATION: 600,
            CONF_MAX_DURATION: "abc",
            CONF_SCHEDULES: ["not_a_dict", valid_schedule],
        },
    )
    await hass.async_block_till_done()

    scheduler = scheduler_of(entry)
    # Defensive properties: no exception, defaults used, malformed item filtered.
    assert scheduler.max_duration == DEFAULT_MAX_DURATION
    assert scheduler.default_duration == 600
    assert scheduler.schedules == [valid_schedule]

    # The sensor mounted its attributes with the defaults (no crash).
    sensor_eid = entity_id_of(hass, entry, "sensor", "next_run")
    assert sensor_eid is not None
    state = hass.states.get(sensor_eid)
    assert state is not None
    assert state.attributes["max_duration"] == DEFAULT_MAX_DURATION
    assert state.attributes["default_duration"] == 600
    assert state.attributes["schedules"] == [valid_schedule]

    # water_now without a duration uses the (default) zone default.
    await hass.services.async_call(
        DOMAIN, SERVICE_WATER_NOW, {"entity_id": sensor_eid}, blocking=True
    )
    await hass.async_block_till_done()
    assert scheduler.is_watering
    assert scheduler.active_duration == 600
    assert scheduler.started_at is not None
    assert scheduler.finishes_at is not None
    assert (scheduler.finishes_at - scheduler.started_at).total_seconds() == 600


@pytest.mark.parametrize(
    ("option_key", "option_value", "expected_default"),
    [
        # "0" parses via int() but is below MIN_DURATION (semantically invalid).
        (CONF_DEFAULT_DURATION, "0", DEFAULT_DEFAULT_DURATION),
        # "-5" parses via int() but is below MIN_DURATION.
        (CONF_MAX_DURATION, "-5", DEFAULT_MAX_DURATION),
        # A float is silently truncated to 3 by int(); rejected as non-integer.
        (CONF_MAX_DURATION, 3.7, DEFAULT_MAX_DURATION),
    ],
)
async def test_semantically_invalid_duration_options_fall_back_to_defaults(
    hass: HomeAssistant,
    setup_zone,
    option_key: str,
    option_value,
    expected_default: int,
) -> None:
    """REGRESSION: duration options that ``int()`` can parse but that are
    semantically invalid -- out of range, or a float that would be silently
    truncated -- fall back to the default (with a warning) and the sensor
    still mounts its attributes without raising."""
    entry = await setup_zone(
        target_entity_id="switch.zone1",
        name="Garden",
        options={
            CONF_ENABLED: True,
            CONF_DEFAULT_DURATION: 600,
            CONF_MAX_DURATION: 7200,
            CONF_SCHEDULES: [],
            option_key: option_value,
        },
    )
    await hass.async_block_till_done()

    scheduler = scheduler_of(entry)
    if option_key == CONF_DEFAULT_DURATION:
        assert scheduler.default_duration == expected_default
    else:
        assert scheduler.max_duration == expected_default

    # The sensor mounted its attributes with the default (no exception).
    sensor_eid = entity_id_of(hass, entry, "sensor", "next_run")
    assert sensor_eid is not None
    state = hass.states.get(sensor_eid)
    assert state is not None
    assert state.attributes[option_key] == expected_default
