"""Integration tests for the targeted services."""

from __future__ import annotations

from datetime import timedelta

import pytest
from homeassistant.const import STATE_OFF, STATE_ON
from homeassistant.core import HomeAssistant
from homeassistant.exceptions import ServiceValidationError
from pytest_homeassistant_custom_component.common import (
    async_fire_time_changed_exact,
    async_mock_service,
)

from custom_components.irrigation_scheduler.const import (
    CONF_DEFAULT_DURATION,
    CONF_EC_ENTITY_ID,
    CONF_ENABLED,
    CONF_FLOW_RATE_LPH,
    CONF_MAX_DURATION,
    CONF_NUMBER_OF_POTS,
    CONF_POT_SENSORS,
    CONF_RESERVOIR_VOLUME_L,
    CONF_SCHEDULES,
    DOMAIN,
    SERVICE_ADD_SCHEDULE,
    SERVICE_REMOVE_SCHEDULE,
    SERVICE_SET_SCHEDULES,
    SERVICE_SET_ZONE_OPTIONS,
    SERVICE_UPDATE_SCHEDULE,
    SERVICE_WATER_NOW,
)

from .conftest import entity_id_of, scheduler_of


async def test_water_now_turns_target_on_and_off_after_duration(
    hass: HomeAssistant, setup_zone, mock_homeassistant_services
) -> None:
    """8. water_now turns the target on; when the duration elapses it turns
    the target back off."""
    hass.states.async_set("switch.zone1", STATE_OFF)
    entry = await setup_zone(target_entity_id="switch.zone1", name="Garden")
    sensor_eid = entity_id_of(hass, entry, "sensor", "next_run")
    binary_eid = entity_id_of(hass, entry, "binary_sensor", "watering")
    assert sensor_eid and binary_eid

    assert hass.states.get("switch.zone1").state == STATE_OFF
    await hass.services.async_call(
        DOMAIN, SERVICE_WATER_NOW, {"entity_id": sensor_eid}, blocking=True
    )
    await hass.async_block_till_done()

    scheduler = scheduler_of(entry)
    assert scheduler.is_watering
    assert hass.states.get("switch.zone1").state == STATE_ON
    assert hass.states.get(binary_eid).state == STATE_ON

    # Let the duration elapse. Fire slightly after finishes_at so the timer is
    # guaranteed to fire even if real time advanced a few microseconds since
    # the timer was armed.
    assert scheduler.finishes_at is not None
    async_fire_time_changed_exact(
        hass, scheduler.finishes_at + timedelta(seconds=1)
    )
    await hass.async_block_till_done()

    assert not scheduler.is_watering
    assert hass.states.get("switch.zone1").state == STATE_OFF
    assert hass.states.get(binary_eid).state == STATE_OFF


async def test_overlapping_schedule_slots_are_rejected(
    hass: HomeAssistant, setup_zone
) -> None:
    entry = await setup_zone(target_entity_id="switch.zone1", name="Garden")
    sensor_eid = entity_id_of(hass, entry, "sensor", "next_run")
    payload = {
        "entity_id": sensor_eid,
        CONF_SCHEDULES: [
            {"id": "a", "time": "06:00:00", "days": [0], "duration": 60},
            {"id": "b", "time": "06:00:00", "days": [0], "duration": 120},
        ],
    }

    with pytest.raises(ServiceValidationError, match="overlap"):
        await hass.services.async_call(
            DOMAIN, SERVICE_SET_SCHEDULES, payload, blocking=True
        )


async def test_water_now_duration_is_clamped_to_max_duration(
    hass: HomeAssistant, setup_zone, mock_homeassistant_services
) -> None:
    """9. A water_now duration above max_duration is clamped."""
    entry = await setup_zone(
        target_entity_id="switch.zone1",
        name="Garden",
        options={
            CONF_ENABLED: True,
            CONF_DEFAULT_DURATION: 600,
            CONF_MAX_DURATION: 120,
            CONF_SCHEDULES: [],
        },
    )
    sensor_eid = entity_id_of(hass, entry, "sensor", "next_run")
    binary_eid = entity_id_of(hass, entry, "binary_sensor", "watering")
    assert sensor_eid and binary_eid

    await hass.services.async_call(
        DOMAIN,
        SERVICE_WATER_NOW,
        {"entity_id": sensor_eid, "duration": 3600},
        blocking=True,
    )
    await hass.async_block_till_done()

    scheduler = scheduler_of(entry)
    assert scheduler.is_watering
    assert scheduler.active_duration == 120
    assert scheduler.started_at is not None
    assert scheduler.finishes_at is not None
    assert (scheduler.finishes_at - scheduler.started_at).total_seconds() == 120

    binary_state = hass.states.get(binary_eid)
    assert binary_state is not None
    assert binary_state.attributes["duration"] == 120


async def test_valve_target_uses_open_valve_not_homeassistant_turn_on(
    hass: HomeAssistant, setup_zone, mock_valve_services
) -> None:
    """10. A valve target is actuated through valve.open_valve and
    homeassistant.turn_on is NEVER used (regression of BLOCKER 1)."""
    open_calls, close_calls = mock_valve_services
    homeassistant_turn_on = async_mock_service(hass, "homeassistant", "turn_on")
    homeassistant_turn_off = async_mock_service(hass, "homeassistant", "turn_off")

    hass.states.async_set("valve.v1", "closed")
    entry = await setup_zone(target_entity_id="valve.v1", name="Valve zone")
    sensor_eid = entity_id_of(hass, entry, "sensor", "next_run")
    assert sensor_eid

    await hass.services.async_call(
        DOMAIN, SERVICE_WATER_NOW, {"entity_id": sensor_eid}, blocking=True
    )
    await hass.async_block_till_done()

    assert len(open_calls) == 1
    assert open_calls[0].data["entity_id"] == "valve.v1"
    # BLOCKER 1 regression: the generic turn_on service is never used.
    assert homeassistant_turn_on == []
    assert hass.states.get("valve.v1").state == "open"

    scheduler = scheduler_of(entry)
    assert scheduler.is_watering
    assert scheduler.finishes_at is not None
    async_fire_time_changed_exact(
        hass, scheduler.finishes_at + timedelta(seconds=1)
    )
    await hass.async_block_till_done()

    assert len(close_calls) == 1
    assert hass.states.get("valve.v1").state == "closed"
    assert homeassistant_turn_off == []


async def test_update_schedule_preserves_id_end_to_end(
    hass: HomeAssistant, setup_zone
) -> None:
    """11. update_schedule preserves the schedule id end-to-end through the
    service (regression of BLOCKER 2)."""
    schedules = [
        {
            "id": "aaaa1111",
            "time": "06:00:00",
            "days": [0],
            "duration": 900,
            "enabled": True,
        }
    ]
    entry = await setup_zone(
        target_entity_id="switch.zone1",
        name="Garden",
        options={
            CONF_ENABLED: True,
            CONF_DEFAULT_DURATION: 600,
            CONF_MAX_DURATION: 7200,
            CONF_SCHEDULES: schedules,
        },
    )
    sensor_eid = entity_id_of(hass, entry, "sensor", "next_run")
    assert sensor_eid

    await hass.services.async_call(
        DOMAIN,
        SERVICE_UPDATE_SCHEDULE,
        {"entity_id": sensor_eid, "id": "aaaa1111", "duration": 1200},
        blocking=True,
    )
    await hass.async_block_till_done()

    updated = list(entry.options[CONF_SCHEDULES])
    assert len(updated) == 1
    assert updated[0]["id"] == "aaaa1111"
    assert updated[0]["duration"] == 1200
    assert updated[0]["time"] == "06:00:00"


async def test_add_schedule_with_colliding_id_generates_a_fresh_id(
    hass: HomeAssistant, setup_zone
) -> None:
    """REGRESSION (B7): add_schedule accepts an optional caller-supplied id
    (needed so set_schedules can preserve ids of existing items), but must
    never silently create a DUPLICATE id -- a fresh one is generated instead.
    """
    schedules = [
        {
            "id": "aaaa1111",
            "time": "06:00:00",
            "days": [0],
            "duration": 900,
            "enabled": True,
        }
    ]
    entry = await setup_zone(
        target_entity_id="switch.zone1",
        name="Garden",
        options={
            CONF_ENABLED: True,
            CONF_DEFAULT_DURATION: 600,
            CONF_MAX_DURATION: 7200,
            CONF_SCHEDULES: schedules,
        },
    )
    sensor_eid = entity_id_of(hass, entry, "sensor", "next_run")
    assert sensor_eid

    await hass.services.async_call(
        DOMAIN,
        SERVICE_ADD_SCHEDULE,
        {
            "entity_id": sensor_eid,
            "id": "aaaa1111",  # collides with the existing schedule
            "time": "07:00:00",
            "days": [1],
            "duration": 300,
        },
        blocking=True,
    )
    await hass.async_block_till_done()

    stored = list(entry.options[CONF_SCHEDULES])
    assert len(stored) == 2
    ids = [s["id"] for s in stored]
    assert len(set(ids)) == 2  # no duplicate
    assert ids[0] == "aaaa1111"  # the original entry is untouched
    assert ids[1] != "aaaa1111"  # the new one got a fresh id


async def test_update_schedule_unknown_id_raises_instead_of_silent_noop(
    hass: HomeAssistant, setup_zone
) -> None:
    """REGRESSION (B8): a typo'd/unknown schedule id must surface an error,
    not silently do nothing."""
    entry = await setup_zone(target_entity_id="switch.zone1", name="Garden")
    sensor_eid = entity_id_of(hass, entry, "sensor", "next_run")
    assert sensor_eid

    with pytest.raises(ServiceValidationError):
        await hass.services.async_call(
            DOMAIN,
            SERVICE_UPDATE_SCHEDULE,
            {"entity_id": sensor_eid, "id": "does-not-exist", "duration": 300},
            blocking=True,
        )
    await hass.async_block_till_done()


async def test_remove_schedule_unknown_id_raises_instead_of_silent_noop(
    hass: HomeAssistant, setup_zone
) -> None:
    """REGRESSION (B8): a typo'd/unknown schedule id must surface an error,
    not silently do nothing."""
    entry = await setup_zone(target_entity_id="switch.zone1", name="Garden")
    sensor_eid = entity_id_of(hass, entry, "sensor", "next_run")
    assert sensor_eid

    with pytest.raises(ServiceValidationError):
        await hass.services.async_call(
            DOMAIN,
            SERVICE_REMOVE_SCHEDULE,
            {"entity_id": sensor_eid, "id": "does-not-exist"},
            blocking=True,
        )
    await hass.async_block_till_done()


async def test_set_schedules_without_schedules_field_raises_service_validation_error(
    hass: HomeAssistant, setup_zone
) -> None:
    """REGRESSION (B1/deepseek): missing the required 'schedules' field used
    to raise a bare KeyError instead of a proper ServiceValidationError."""
    entry = await setup_zone(target_entity_id="switch.zone1", name="Garden")
    sensor_eid = entity_id_of(hass, entry, "sensor", "next_run")
    assert sensor_eid

    with pytest.raises(ServiceValidationError):
        await hass.services.async_call(
            DOMAIN,
            SERVICE_SET_SCHEDULES,
            {"entity_id": sensor_eid},
            blocking=True,
        )
    await hass.async_block_till_done()


async def test_service_targets_device_and_area(
    hass: HomeAssistant,
    setup_zone,
    mock_homeassistant_services,
    device_registry,
    area_registry,
    entity_registry,
) -> None:
    """12. Targeting a device works; targeting an area containing that device
    works too (regression of item 4)."""
    entry = await setup_zone(target_entity_id="switch.zone1", name="Garden")
    sensor_eid = entity_id_of(hass, entry, "sensor", "next_run")
    assert sensor_eid

    # Resolve our device from the entity registry.
    reg_entry = entity_registry.async_get(sensor_eid)
    assert reg_entry is not None and reg_entry.device_id is not None
    device = device_registry.async_get(reg_entry.device_id)
    assert device is not None

    # -- Target the DEVICE --
    await hass.services.async_call(
        DOMAIN, SERVICE_WATER_NOW, {"device_id": device.id}, blocking=True
    )
    await hass.async_block_till_done()
    scheduler = scheduler_of(entry)
    assert scheduler.is_watering
    assert hass.states.get("switch.zone1").state == STATE_ON

    # -- Target the AREA that contains the device --
    await scheduler.async_stop()
    await hass.async_block_till_done()
    assert not scheduler.is_watering
    assert hass.states.get("switch.zone1").state == STATE_OFF

    area = area_registry.async_create("Garden area")
    device_registry.async_update_device(device.id, area_id=area.id)

    await hass.services.async_call(
        DOMAIN, SERVICE_WATER_NOW, {"area_id": area.id}, blocking=True
    )
    await hass.async_block_till_done()
    assert scheduler.is_watering
    assert hass.states.get("switch.zone1").state == STATE_ON


async def test_targeting_foreign_entity_raises_service_validation_error(
    hass: HomeAssistant, setup_zone
) -> None:
    """13. Targeting an entity that is not part of the integration raises
    ServiceValidationError."""
    await setup_zone(target_entity_id="switch.zone1", name="Garden")

    with pytest.raises(ServiceValidationError):
        await hass.services.async_call(
            DOMAIN,
            SERVICE_WATER_NOW,
            {"entity_id": "switch.some_foreign_switch"},
            blocking=True,
        )


async def test_set_schedules_preserves_ids_and_generates_missing_ones(
    hass: HomeAssistant, setup_zone
) -> None:
    """14. set_schedules preserves existing ids and generates an id only for
    items without one."""
    entry = await setup_zone(target_entity_id="switch.zone1", name="Garden")
    sensor_eid = entity_id_of(hass, entry, "sensor", "next_run")
    assert sensor_eid

    await hass.services.async_call(
        DOMAIN,
        SERVICE_SET_SCHEDULES,
        {
            "entity_id": sensor_eid,
            "schedules": [
                {
                    "id": "bbbb2222",
                    "time": "07:00:00",
                    "days": [1],
                    "duration": 900,
                    "enabled": True,
                },
                {
                    "time": "08:00:00",
                    "days": [2],
                    "duration": 1200,
                    "enabled": True,
                },
            ],
        },
        blocking=True,
    )
    await hass.async_block_till_done()

    schedules = list(entry.options[CONF_SCHEDULES])
    assert len(schedules) == 2
    with_id = schedules[0]
    without_id = schedules[1]
    assert with_id["id"] == "bbbb2222"
    assert with_id["duration"] == 900
    assert without_id["id"] is not None
    assert len(without_id["id"]) == 8
    assert without_id["duration"] == 1200


async def test_set_schedules_with_non_dict_item_raises_service_validation_error(
    hass: HomeAssistant, setup_zone
) -> None:
    """REGRESSION: set_schedules with a non-dict item raises
    ServiceValidationError naming the item index, instead of a raw ValueError
    from ``dict(item)``."""
    entry = await setup_zone(target_entity_id="switch.zone1", name="Garden")
    sensor_eid = entity_id_of(hass, entry, "sensor", "next_run")
    assert sensor_eid

    with pytest.raises(ServiceValidationError) as excinfo:
        await hass.services.async_call(
            DOMAIN,
            SERVICE_SET_SCHEDULES,
            {
                "entity_id": sensor_eid,
                "schedules": [
                    {
                        "time": "07:00:00",
                        "days": [1],
                        "duration": 900,
                        "enabled": True,
                    },
                    "texto",
                ],
            },
            blocking=True,
        )
    await hass.async_block_till_done()

    assert "index 1" in str(excinfo.value)
    # The stored schedules were left untouched by the failed call.
    assert entry.options[CONF_SCHEDULES] == []


async def test_set_zone_options_updates_flow_rate_and_pots(hass: HomeAssistant, setup_zone) -> None:
    """set_zone_options updates flow rate / pots without reloading the entry."""
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
    scheduler_before = scheduler_of(entry)

    await hass.services.async_call(
        DOMAIN,
        SERVICE_SET_ZONE_OPTIONS,
        {
            "entity_id": sensor_eid,
            CONF_FLOW_RATE_LPH: 300,
            CONF_NUMBER_OF_POTS: 12,
            CONF_RESERVOIR_VOLUME_L: 1000,
        },
        blocking=True,
    )
    await hass.async_block_till_done()

    assert entry.options[CONF_FLOW_RATE_LPH] == 300
    assert entry.options[CONF_NUMBER_OF_POTS] == 12
    assert entry.options[CONF_RESERVOIR_VOLUME_L] == 1000
    # The entry was NOT reloaded: the same scheduler instance lives on.
    assert scheduler_of(entry) is scheduler_before

    # The sensor now exposes the updated values.
    state = hass.states.get(sensor_eid)
    assert state is not None
    assert state.attributes[CONF_FLOW_RATE_LPH] == 300
    assert state.attributes[CONF_NUMBER_OF_POTS] == 12
    assert state.attributes[CONF_RESERVOIR_VOLUME_L] == 1000


async def test_set_zone_options_persists_ordered_pot_sensors(
    hass: HomeAssistant, setup_zone
) -> None:
    """The compact sensor grid is configured once and exposed by the card contract."""
    entry = await setup_zone(target_entity_id="switch.zone1", name="Garden")
    sensor_eid = entity_id_of(hass, entry, "sensor", "next_run")
    assert sensor_eid
    configured = [
        {"name": "Fileira 1", "entity_id": "sensor.fileira_1"},
        {"name": "Mesa 2", "entity_id": "sensor.mesa_2"},
    ]

    await hass.services.async_call(
        DOMAIN,
        SERVICE_SET_ZONE_OPTIONS,
        {"entity_id": sensor_eid, CONF_POT_SENSORS: configured},
        blocking=True,
    )
    await hass.async_block_till_done()

    assert entry.options[CONF_POT_SENSORS] == configured
    assert scheduler_of(entry).pot_sensors == configured
    state = hass.states.get(sensor_eid)
    assert state is not None
    assert state.attributes[CONF_POT_SENSORS] == configured


async def test_set_zone_options_updates_and_clears_ec_entity(
    hass: HomeAssistant, setup_zone
) -> None:
    """ec_entity_id is display-only: it can be set and explicitly cleared,
    same empty-string-disables semantics as ph_entity_id, but never gates a
    run (there is no min/max for it)."""
    entry = await setup_zone(target_entity_id="switch.zone1", name="Garden")
    sensor_eid = entity_id_of(hass, entry, "sensor", "next_run")
    assert sensor_eid

    await hass.services.async_call(
        DOMAIN,
        SERVICE_SET_ZONE_OPTIONS,
        {"entity_id": sensor_eid, CONF_EC_ENTITY_ID: "sensor.reservoir_ec"},
        blocking=True,
    )
    await hass.async_block_till_done()

    scheduler = scheduler_of(entry)
    assert scheduler.ec_entity_id == "sensor.reservoir_ec"
    state = hass.states.get(sensor_eid)
    assert state is not None
    assert state.attributes[CONF_EC_ENTITY_ID] == "sensor.reservoir_ec"

    await hass.services.async_call(
        DOMAIN,
        SERVICE_SET_ZONE_OPTIONS,
        {"entity_id": sensor_eid, CONF_EC_ENTITY_ID: ""},
        blocking=True,
    )
    await hass.async_block_till_done()
    assert scheduler.ec_entity_id == ""


async def test_set_zone_options_updates_default_duration(
    hass: HomeAssistant, setup_zone
) -> None:
    """default_duration is editable from the card's settings panel, used by
    water_now, and validated against the zone's stored max_duration."""
    entry = await setup_zone(
        target_entity_id="switch.zone1",
        name="Garden",
        options={
            CONF_ENABLED: True,
            CONF_DEFAULT_DURATION: 600,
            CONF_MAX_DURATION: 1200,
            CONF_SCHEDULES: [],
        },
    )
    sensor_eid = entity_id_of(hass, entry, "sensor", "next_run")
    assert sensor_eid

    await hass.services.async_call(
        DOMAIN,
        SERVICE_SET_ZONE_OPTIONS,
        {"entity_id": sensor_eid, CONF_DEFAULT_DURATION: 900},
        blocking=True,
    )
    await hass.async_block_till_done()

    scheduler = scheduler_of(entry)
    assert scheduler.default_duration == 900

    with pytest.raises(ServiceValidationError):
        await hass.services.async_call(
            DOMAIN,
            SERVICE_SET_ZONE_OPTIONS,
            {"entity_id": sensor_eid, CONF_DEFAULT_DURATION: 1201},
            blocking=True,
        )
    await hass.async_block_till_done()
    # Rejected: still the previously valid value, not the invalid one.
    assert scheduler.default_duration == 900


async def test_set_zone_options_rejects_negative(hass: HomeAssistant, setup_zone) -> None:
    """set_zone_options rejects negative values."""
    import voluptuous as vol

    entry = await setup_zone(target_entity_id="switch.zone1", name="Garden")
    sensor_eid = entity_id_of(hass, entry, "sensor", "next_run")
    assert sensor_eid is not None

    with pytest.raises(vol.error.MultipleInvalid):
        await hass.services.async_call(
            DOMAIN,
            SERVICE_SET_ZONE_OPTIONS,
            {"entity_id": sensor_eid, CONF_FLOW_RATE_LPH: -5},
            blocking=True,
        )
    await hass.async_block_till_done()

    assert entry.options.get(CONF_FLOW_RATE_LPH, 0) == 0
