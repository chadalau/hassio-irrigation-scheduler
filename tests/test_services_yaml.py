"""``services.yaml`` must satisfy Home Assistant's own service-description schema.

REGRESSION: two ``mode: box`` lines belonging to the ``ph_max``/``ph_max_2``
number selectors had drifted one field down, into the ``text:`` selector of
``ec_entity_id``/``ec_entity_id_2``. ``TextSelector`` rejects ``mode``, and
``homeassistant.helpers.service._load_services_file`` catches that
``vol.Invalid`` and returns ``{}`` -- silently dropping the descriptions of
ALL EIGHT services (name, description, target picker and every field) with
nothing but a log warning. The services kept working when called, so no
existing test noticed; only the Developer Tools "Actions" UI was gutted.

Kept OUT of ``tests/integration`` on purpose: it needs no ``hass`` fixture,
which makes it runnable anywhere ``homeassistant`` is importable, and skipped
cleanly in the pure (HA-less) environment.
"""

from __future__ import annotations

from pathlib import Path

import pytest
import voluptuous as vol

yaml = pytest.importorskip("yaml")
ha_service = pytest.importorskip("homeassistant.helpers.service")

SERVICES_YAML = (
    Path(__file__).resolve().parents[1]
    / "custom_components"
    / "irrigation_scheduler"
    / "services.yaml"
)


def _load() -> dict:
    return yaml.safe_load(SERVICES_YAML.read_text(encoding="utf-8"))


def _integration():
    """The integration package, or skip.

    Importing it pulls Home Assistant's ``http``/``zeroconf`` stack, which
    some environments cannot load (e.g. a Windows App Control policy blocking
    a zeroconf DLL). The schema test above needs none of that and must keep
    running there.
    """
    return pytest.importorskip("custom_components.irrigation_scheduler")


def test_services_yaml_matches_home_assistant_schema() -> None:
    """The file HA actually parses at runtime must validate cleanly."""
    # Raises vol.Invalid (failing the test) exactly where HA would silently
    # fall back to "{}" and drop every description.
    ha_service._SERVICES_SCHEMA(_load())


def test_every_registered_service_is_described() -> None:
    """Each service the integration registers has an entry in services.yaml."""
    const = pytest.importorskip("custom_components.irrigation_scheduler.const")

    described = set(_load())
    registered = {
        const.SERVICE_WATER_NOW,
        const.SERVICE_STOP,
        const.SERVICE_ADD_SCHEDULE,
        const.SERVICE_UPDATE_SCHEDULE,
        const.SERVICE_REMOVE_SCHEDULE,
        const.SERVICE_SET_SCHEDULES,
        const.SERVICE_SET_ZONE_OPTIONS,
        const.SERVICE_REFILL_RESERVOIR,
    }
    assert registered <= described


def test_set_zone_options_documents_every_accepted_field() -> None:
    """Every field the service accepts is visible in the Actions UI.

    ``set_zone_options`` is registered with ``schema=None`` and validated by
    hand, so a field added to SET_ZONE_OPTIONS_SCHEMA without a services.yaml
    entry would work when called from the card and be invisible in the UI.
    """
    integration = _integration()

    accepted = {str(key) for key in integration.SET_ZONE_OPTIONS_SCHEMA.schema}
    documented = set(_load()["set_zone_options"]["fields"])
    assert accepted == documented


@pytest.mark.parametrize(
    "pot_sensors",
    [
        [{"name": "", "entity_id": "sensor.row_1"}],
        [{"name": "Row 1", "entity_id": "binary_sensor.row_1"}],
        [
            {"name": "Row 1", "entity_id": "sensor.same"},
            {"name": "Row 2", "entity_id": "sensor.same"},
        ],
    ],
)
def test_set_zone_options_rejects_invalid_pot_sensors(pot_sensors: list[dict]) -> None:
    """Pot sensor entries must be complete, numeric-sensor entities, and unique."""
    integration = _integration()
    with pytest.raises(vol.Invalid):
        integration.SET_ZONE_OPTIONS_SCHEMA({"pot_sensors": pot_sensors})
