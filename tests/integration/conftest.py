"""Shared fixtures for the Home Assistant integration test suite.

This directory runs under ``pytest-homeassistant-custom-component`` (PHCC),
which is ONLY available in the HA test venv. It deliberately lives here (and
NOT in ``tests/conftest.py``) so the pure, HA-free tests in ``tests/`` keep
running with a plain pytest in the pure venv.

Windows note
------------
PHCC installs pytest_socket's ``GuardedSocket`` as ``socket.socket`` for every
test. On POSIX the asyncio event loop's self-pipe is an AF_UNIX socket pair
(which pytest_socket allows), but on Windows ``socket.socketpair()`` creates
AF_INET sockets and would raise ``SocketBlockedError`` while the loop starts.
``socketpair`` is implemented in pure Python on Windows and calls
``socket.socket`` internally, so we temporarily restore the REAL socket class
while it runs. This is a Windows-only shim, harmless on POSIX.
"""

from __future__ import annotations

import shutil
import socket as _socket
from pathlib import Path
from typing import Any, Awaitable, Callable
from unittest.mock import patch

import pytest
from homeassistant.components.frontend import DATA_EXTRA_MODULE_URL, UrlManager
from homeassistant.const import EVENT_STATE_CHANGED, STATE_OFF, STATE_ON
from homeassistant.core import HomeAssistant, State, callback
from homeassistant.helpers import entity_registry as er

from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.irrigation_scheduler.const import (
    CARD_JS_FILENAME,
    CONF_DEFAULT_DURATION,
    CONF_ENABLED,
    CONF_MAX_DURATION,
    CONF_NAME,
    CONF_SCHEDULES,
    CONF_TARGET_ENTITY_ID,
    DEFAULT_MAX_DURATION,
    DOMAIN,
)
from custom_components.irrigation_scheduler.scheduler import IrrigationScheduler

# The real socket class / socketpair, captured at import time (before
# pytest_socket's guard is installed).
_TRUE_SOCKET = _socket.socket
_TRUE_SOCKETPAIR = _socket.socketpair


def _socketpair_unblocked(*args, **kwargs):
    """``socket.socketpair`` that bypasses pytest_socket's GuardedSocket."""
    current = _socket.socket
    _socket.socket = _TRUE_SOCKET
    try:
        return _TRUE_SOCKETPAIR(*args, **kwargs)
    finally:
        _socket.socket = current


_patch_socketpair = patch("socket.socketpair", _socketpair_unblocked)
_patch_socketpair.start()


@pytest.fixture(autouse=True)
def auto_enable_custom_integrations(enable_custom_integrations):
    """Make the HA loader discover the integration in custom_components/."""
    yield


@pytest.fixture(autouse=True)
def mock_frontend_component(hass: HomeAssistant) -> None:
    """Fake a loaded ``frontend`` component and ship the card JS to the config dir.

    On a real HA instance the frontend is ALWAYS loaded and its ``async_setup``
    creates ``hass.data["frontend_extra_module_url"]`` (the ``UrlManager`` that
    ``add_extra_js_url``/``remove_extra_js_url`` write to). In this harness the
    real frontend cannot be set up because ``hass_frontend`` is not installed
    in the venv -- but the integration's manifest now declares ``frontend`` as
    a hard dependency, so HA would refuse to load the integration if the
    component were not in ``hass.config.components``. Emulating a loaded
    frontend reflects the real 2026.2.3 runtime (frontend is always up there).

    The placeholder card JS is also copied next to the integration in the
    (test) config dir, exactly where production ships it, so
    ``hass.config.path("custom_components", DOMAIN, "frontend", ...)`` resolves
    to an existing file -- as it does on a real install.
    """
    hass.config.components.add("frontend")
    hass.data[DATA_EXTRA_MODULE_URL] = UrlManager(lambda *_args: None, [])

    repo_root = Path(__file__).resolve().parents[2]
    src_js = repo_root / "custom_components" / DOMAIN / "frontend" / CARD_JS_FILENAME
    target_dir = Path(hass.config.path("custom_components", DOMAIN, "frontend"))
    target_dir.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src_js, target_dir / CARD_JS_FILENAME)


# ---------------------------------------------------------------------------
# Config entry / zone setup
# ---------------------------------------------------------------------------
@pytest.fixture
def setup_zone(hass: HomeAssistant) -> Callable[..., Awaitable[MockConfigEntry]]:
    """Return an async helper that creates and starts a zone config entry."""

    async def _setup(
        target_entity_id: str = "switch.zone1",
        name: str = "Zone 1",
        options: dict[str, Any] | None = None,
        entry_id: str | None = None,
        unique_id: str | None = None,
    ) -> MockConfigEntry:
        if options is None:
            options = {
                CONF_ENABLED: True,
                CONF_DEFAULT_DURATION: 600,
                CONF_MAX_DURATION: DEFAULT_MAX_DURATION,
                CONF_SCHEDULES: [],
            }
        entry = MockConfigEntry(
            domain=DOMAIN,
            title=name,
            data={
                CONF_NAME: name,
                CONF_TARGET_ENTITY_ID: target_entity_id,
            },
            options=options,
            entry_id=entry_id,
            unique_id=unique_id or target_entity_id,
        )
        entry.add_to_hass(hass)
        assert await hass.config_entries.async_setup(entry.entry_id)
        await hass.async_block_till_done()
        return entry

    return _setup


def scheduler_of(entry: MockConfigEntry) -> IrrigationScheduler:
    """Return the IrrigationScheduler stored in the entry's runtime data."""
    scheduler: IrrigationScheduler = entry.runtime_data
    return scheduler


def entity_id_of(
    hass: HomeAssistant, entry: MockConfigEntry, platform: str, suffix: str
) -> str | None:
    """Resolve the entity_id of one of our entities via its unique_id."""
    registry = er.async_get(hass)
    return registry.async_get_entity_id(
        platform, DOMAIN, f"{entry.entry_id}_{suffix}"
    )


# ---------------------------------------------------------------------------
# Target actuation mocks
# ---------------------------------------------------------------------------
def _set_entity_states(hass: HomeAssistant, call, state: str) -> None:
    entity_ids = call.data.get("entity_id")
    if isinstance(entity_ids, str):
        entity_ids = [entity_ids]
    for entity_id in entity_ids or []:
        hass.states.async_set(entity_id, state)


@pytest.fixture
def mock_homeassistant_services(hass: HomeAssistant):
    """Mock homeassistant.turn_on/turn_off so they actually flip target state.

    Returns ``(turn_on_calls, turn_off_calls)``.
    """
    turn_on_calls = []
    turn_off_calls = []

    @callback
    def _turn_on(call):
        turn_on_calls.append(call)
        _set_entity_states(hass, call, STATE_ON)

    @callback
    def _turn_off(call):
        turn_off_calls.append(call)
        _set_entity_states(hass, call, STATE_OFF)

    hass.services.async_register("homeassistant", "turn_on", _turn_on)
    hass.services.async_register("homeassistant", "turn_off", _turn_off)
    return turn_on_calls, turn_off_calls


@pytest.fixture
def mock_valve_services(hass: HomeAssistant):
    """Mock valve.open_valve/close_valve so they actually flip target state.

    Returns ``(open_calls, close_calls)``.
    """
    open_calls = []
    close_calls = []

    @callback
    def _open(call):
        open_calls.append(call)
        _set_entity_states(hass, call, "open")

    @callback
    def _close(call):
        close_calls.append(call)
        _set_entity_states(hass, call, "closed")

    hass.services.async_register("valve", "open_valve", _open)
    hass.services.async_register("valve", "close_valve", _close)
    return open_calls, close_calls


class AsyncDevice:
    """Helper simulating a target whose actuation is ASYNCHRONOUS.

    A real Z-Wave/Zigbee/MQTT switch or motorized valve does not change state
    when the service returns: the service only DISPATCHES the command and the
    entity state catches up seconds later (or never, if the device is
    unreachable). These mocks reproduce exactly that: ``turn_on``/``turn_off``
    record the call and return WITHOUT touching the state machine. The test
    controls WHEN the state changes through :meth:`set_state`.
    """

    def __init__(self, hass: HomeAssistant) -> None:
        """Register the recording services and expose call logs."""
        self.hass = hass
        self.turn_on_calls = []
        self.turn_off_calls = []
        hass.services.async_register("homeassistant", "turn_on", self._record_on)
        hass.services.async_register("homeassistant", "turn_off", self._record_off)

    @callback
    def _record_on(self, call):
        self.turn_on_calls.append(call)

    @callback
    def _record_off(self, call):
        self.turn_off_calls.append(call)

    def set_state(self, entity_id: str, state: str) -> None:
        """Flip the entity state, as the real device would report it.

        This is the ONLY way the target state changes in these tests.
        """
        self.hass.states.async_set(entity_id, state)

    def deliver_stale_off(self, entity_id: str) -> None:
        """Deliver a STALE 'off' state-changed event without touching the state.

        With an async device the echo of a finished run's ``turn_off`` can
        arrive AFTER a newer run already actuated the target: the state machine
        says ON while the event's ``new_state`` snapshot says OFF. This fires
        exactly such an event while leaving the state machine untouched.
        """
        current = self.hass.states.get(entity_id)
        self.hass.bus.async_fire(
            EVENT_STATE_CHANGED,
            {
                "entity_id": entity_id,
                "old_state": current,
                "new_state": State(entity_id, STATE_OFF),
            },
        )


@pytest.fixture
def async_device(hass: HomeAssistant) -> AsyncDevice:
    """Mock services for a target whose state only changes explicitly.

    The ``turn_on``/``turn_off`` services record the call and return WITHOUT
    changing the state machine -- exactly like Z-Wave, Zigbee, MQTT or
    motorized valves, where the service returns as soon as the command is
    dispatched. The test controls when the state changes via
    ``AsyncDevice.set_state`` / ``AsyncDevice.deliver_stale_off``.
    """
    return AsyncDevice(hass)
