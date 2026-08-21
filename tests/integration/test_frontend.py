"""Integration tests for the Onda B1 frontend wiring.

Covers serving + registering the card JS with Lovelace:
  - the static path is registered and GET-serves the built card file;
  - ``add_extra_js_url`` registered the URL in the frontend UrlManager
    (``hass.data["frontend_extra_module_url"]``);
  - the URL is removed only when the LAST entry unloads;
  - and is registered AGAIN when a new entry is set up afterwards;
  - a missing card JS logs a warning and never breaks the backend.

The card itself (Lit/TS) is Onda B2 and is not tested here beyond stable
markers in the built file.

Runs under pytest-homeassistant-custom-component (HA test venv only).
"""

from __future__ import annotations

from pathlib import Path

from homeassistant.components.frontend import DATA_EXTRA_MODULE_URL
from homeassistant.core import HomeAssistant

from custom_components.irrigation_scheduler.const import (
    CARD_JS_FILENAME,
    CARD_JS_URL,
    DOMAIN,
)

from .conftest import scheduler_of


def _card_js_path(hass: HomeAssistant) -> Path:
    """The card JS exactly where production ships it (test config dir)."""
    return Path(
        hass.config.path("custom_components", DOMAIN, "frontend", CARD_JS_FILENAME)
    )


async def test_static_path_serves_card_js(
    hass: HomeAssistant, setup_zone, hass_client_no_auth
) -> None:
    """1. async_setup registers the static path; GET returns the built card."""
    await setup_zone(target_entity_id="switch.zone1", name="Garden")

    client = await hass_client_no_auth()
    resp = await client.get(CARD_JS_URL)
    assert resp.status == 200
    body = await resp.text()
    # The served file is the real Onda B2 build (a self-contained IIFE). The
    # custom element name, the integration domain and the registration calls
    # are stable strings guaranteed to survive minification.
    assert "irrigation-schedule-card" in body
    assert "irrigation_scheduler" in body
    assert "customElements.define" in body


async def test_extra_js_url_registered(hass: HomeAssistant, setup_zone) -> None:
    """2. add_extra_js_url was called: the UrlManager holds the card URL."""
    await setup_zone(target_entity_id="switch.zone1", name="Garden")

    manager = hass.data[DATA_EXTRA_MODULE_URL]
    assert CARD_JS_URL in manager.urls


async def test_extra_js_url_removed_only_with_last_entry(
    hass: HomeAssistant, setup_zone
) -> None:
    """3. Unloading one of two entries keeps the URL; the last unload removes it."""
    entry1 = await setup_zone(target_entity_id="switch.zone1", name="Zone 1")
    entry2 = await setup_zone(target_entity_id="switch.zone2", name="Zone 2")
    manager = hass.data[DATA_EXTRA_MODULE_URL]
    assert CARD_JS_URL in manager.urls

    # Unloading the first entry must NOT remove the shared extra JS URL.
    assert await hass.config_entries.async_unload(entry1.entry_id)
    await hass.async_block_till_done()
    assert CARD_JS_URL in manager.urls

    # Unloading the LAST entry removes it.
    assert await hass.config_entries.async_unload(entry2.entry_id)
    await hass.async_block_till_done()
    assert CARD_JS_URL not in manager.urls


async def test_extra_js_url_is_registered_again_after_the_last_unload(
    hass: HomeAssistant, setup_zone, hass_client_no_auth
) -> None:
    """REGRESSION: setting an entry up again after the last one unloaded must
    re-register the card URL.

    ``async_setup`` runs ONCE per process, so it does not run again when an
    entry is added to an already-set-up component -- exactly what happens on a
    "Reload" of the only zone, a HACS update, or a remove + re-add. The
    services were already re-registered per entry for this reason; the extra
    module URL was not, so the card silently stopped loading in new browser
    sessions ("Custom element doesn't exist") until Home Assistant restarted.
    """
    entry = await setup_zone(target_entity_id="switch.zone1", name="Garden")
    manager = hass.data[DATA_EXTRA_MODULE_URL]
    assert CARD_JS_URL in manager.urls

    assert await hass.config_entries.async_unload(entry.entry_id)
    await hass.async_block_till_done()
    assert CARD_JS_URL not in manager.urls

    # A brand-new zone (component already set up -> async_setup does NOT run).
    await setup_zone(target_entity_id="switch.zone2", name="Backyard")
    assert CARD_JS_URL in manager.urls

    # The static path survived the whole cycle: it is registered once per
    # process (re-registering the same route raises in aiohttp) and never
    # unregistered, so the URL still serves the real file.
    client = await hass_client_no_auth()
    resp = await client.get(CARD_JS_URL)
    assert resp.status == 200
    assert "irrigation-schedule-card" in await resp.text()


async def test_reloading_the_only_entry_keeps_the_card_registered(
    hass: HomeAssistant, setup_zone
) -> None:
    """The same regression through the path users actually hit: Reload."""
    entry = await setup_zone(target_entity_id="switch.zone1", name="Garden")
    manager = hass.data[DATA_EXTRA_MODULE_URL]

    await hass.config_entries.async_reload(entry.entry_id)
    await hass.async_block_till_done()

    assert CARD_JS_URL in manager.urls


async def test_missing_card_js_warns_and_does_not_break_setup(
    hass: HomeAssistant, setup_zone, caplog
) -> None:
    """4. Missing card JS: async_setup logs a warning and the backend survives."""
    js_path = _card_js_path(hass)
    renamed = js_path.with_name(js_path.name + ".bak")
    js_path.rename(renamed)
    entry = None
    try:
        entry = await setup_zone(target_entity_id="switch.zone1", name="Garden")
    finally:
        renamed.rename(js_path)
    await hass.async_block_till_done()

    # The backend is NOT broken by the missing card file.
    assert entry is not None
    assert scheduler_of(entry) is not None

    # The extra JS URL was NOT registered (and a clear warning was logged).
    manager = hass.data[DATA_EXTRA_MODULE_URL]
    assert CARD_JS_URL not in manager.urls
    assert "Irrigation Scheduler card JS not found" in caplog.text
    assert str(js_path) in caplog.text
