# Irrigation Scheduler for Home Assistant

Custom Home Assistant integration that schedules irrigation zones, with a
Lovelace card. One config entry = one irrigation zone. Each zone drives a
target entity (valve/switch) at scheduled times for a configurable duration
and turns it off automatically. Scheduling runs in the backend, so it does not
depend on a browser or dashboard being open.

- **Backend:** a full Python integration (`custom_components/irrigation_scheduler`)
  with a config flow, three entities per zone, six services and restart-safe
  run recovery.
- **Card:** `irrigation-schedule-card` (Lit/TypeScript, self-contained build).
  The integration registers it automatically — **no manual Resources entry**.

## Requirements

- Home Assistant **2026.2.3 or newer** (tested against 2026.2.3).
- HACS (recommended) or manual copy of `custom_components/irrigation_scheduler/`
  into your `config/custom_components/`.

## Installation

### Via HACS

1. HACS -> three-dot menu -> **Custom repositories** -> add this repo
   (`https://github.com/jvito/hassio-irrigation-scheduler`) with category
   **Integration**.
2. Install **Irrigation Scheduler** and restart Home Assistant.
3. **Settings -> Devices & Services -> Add Integration -> Irrigation Scheduler**.
4. Pick a target entity (switch, valve, input_boolean or light), a zone name
   and a default duration.

### Card

The card is served and registered by the integration — nothing else to do.
After adding the integration, add a card of type `custom:irrigation-schedule-card`.

## Card configuration

```yaml
type: custom:irrigation-schedule-card
entity: sensor.jardim_next_run   # REQUIRED: the zone's next-run sensor
name: Jardim                     # optional; overrides the zone name
show_next_run: true              # optional, default true
show_water_now: true             # optional, default true
compact: false                   # optional, default false
```

The card has a visual editor (pick the entity/name/toggles without writing
YAML) as well as the YAML form above.

The card shows:

- the zone name, live pH/EC readings next to it (when configured) as bold
  colored badges (pH is green/red depending on whether it's inside
  `ph_min`/`ph_max`), and a master toggle (`switch.<zone>_schedule_enabled`).
  Clicking a pH/EC badge opens Home Assistant's own more-info dialog for that
  sensor (its History tab already renders a daily graph). A zone can
  optionally configure a SECOND, independent reservoir (e.g. one pump/outlet
  feeding two tanks) — its row renders below R1's, each prefixed with a small
  "R1"/"R2" pill instead of a text suffix, columns aligned via CSS grid so pH
  sits above pH and EC above EC. When `reservoir_volume_l` is configured,
  every row also shows the tracked remaining volume ("620/1000 L"), an
  adaptive "time until empty" estimate (hours/days/months, hidden when no
  schedule is enabled) and a **Refil** button that resets the counter to
  full;
- a live countdown bar while watering (computed client-side from
  `finishes_at`, no backend polling) with a **Parar** button;
- the next scheduled run, and (separated by a divider) the last completed
  run — clickable to open a history dialog listing every run from the last
  30 days, grouped by day with per-day totals, each showing its duration,
  volume per pot, and the pH/EC reading at the time it started;
- the list of schedules, one line each: time, a fixed 7-letter day indicator
  (highlighted for the selected days), duration, total volume, volume per
  pot, per-schedule enable/disable/edit/delete, and a `!` warning badge on
  any schedule whose last SCHEDULED firing was skipped by the pH gate (hover
  for the reason);
- an **Adicionar horário** dialog (time, days, duration);
- a **Regar agora** button (uses the zone's default duration);
- a settings panel (gear icon) to edit the default watering duration, flow
  rate per pot, number of pots, reservoir volume, the optional pH gate
  (sensor entity id + min/max) and an optional EC sensor (display-only) for
  up to two independent reservoirs — all without leaving the dashboard.

The card is Portuguese-only by design: every string in it (labels, dialogs,
errors, day abbreviations) is hardcoded, it does not follow `hass.language`.

## Entities (per zone, one device)

| Entity | Purpose |
|---|---|
| `switch.<zone>_schedule_enabled` | Enables/disables the whole schedule of the zone. |
| `sensor.<zone>_next_run` | Next scheduled run (timestamp). Attributes: `schedules`, `target_entity_id`, `default_duration`, `max_duration`, `flow_rate_lph`, `number_of_pots`, `reservoir_volume_l`, `reservoir_remaining_l`, `ph_entity_id`, `ph_min`, `ph_max`, `ec_entity_id`, `ph_entity_id_2`, `ph_min_2`, `ph_max_2`, `ec_entity_id_2`, `schedule_warnings`, `switch_entity_id`, `binary_sensor_entity_id`. |
| `binary_sensor.<zone>_watering` | Reports whether the zone is watering. Attributes: `started_at`, `finishes_at`, `duration`, `source`, `schedule_id`, `last_run`, `history` (last 30 days, most recent first, capped at 200 entries). |

## Services

All services accept an entity target (any entity of the zone) and work with
device/area targets too.

| Service | Description |
|---|---|
| `irrigation_scheduler.water_now` | Start watering now. Optional `duration` (seconds); defaults to the zone default. Clamped to `1..max_duration`. |
| `irrigation_scheduler.stop` | Stop watering and turn the target off. |
| `irrigation_scheduler.add_schedule` | Add a schedule. Fields: `time` (`"HH:MM:SS"`), `days` (`[0..6]`, 0=Monday), `duration` (seconds), `enabled`. |
| `irrigation_scheduler.update_schedule` | Update fields of an existing schedule by `id`. The `id` is immutable. |
| `irrigation_scheduler.remove_schedule` | Remove a schedule by `id`. |
| `irrigation_scheduler.set_schedules` | Replace all schedules of the zone. Existing ids are preserved. |
| `irrigation_scheduler.set_zone_options` | Update optional zone settings: `default_duration`, `flow_rate_lph` (**per pot**), `number_of_pots`, `reservoir_volume_l`, the pH gate (`ph_entity_id`, `ph_min`, `ph_max`) and `ec_entity_id` (display-only, never gates a run) — plus `ph_entity_id_2`, `ph_min_2`, `ph_max_2` and `ec_entity_id_2` for an independent SECOND reservoir (e.g. one pump feeding two tanks): a scheduled run only starts if both reservoirs, when configured, read within their own range. Every field is independently optional; send `ph_entity_id: ""`/`ec_entity_id: ""` (or the `_2` versions) to explicitly clear those. |
| `irrigation_scheduler.refill_reservoir` | Reset the tracked `reservoir_remaining_l` back to full (`reservoir_volume_l`). No fields. Every completed watering run automatically deducts its actual delivered volume from `reservoir_remaining_l` (clamped to `0`); this service is the only way to top it back up. |

```yaml
service: irrigation_scheduler.water_now
target:
  entity_id: sensor.jardim_next_run
data:
  duration: 900
```

## Safety behaviour

- Durations are clamped to `1..max_duration`.
- An active run always has a stop timer armed; there is never a window in
  which the target was told to turn on without a scheduled turn-off.
- Async devices (Z-Wave, Zigbee, MQTT, motorized valves) get an actuation
  grace period; if the target never actuates, the run ends loudly and a
  defensive turn-off is sent.
- If a turn-off fails, the runtime state is kept so the next restart turns the
  target off defensively.
- An active run survives a restart: run state is persisted to a volatile
  `Store` (`irrigation_scheduler.runtime`) and recovered on startup.
- Updating `entry.options` does not reload the entry, so an active run is
  never interrupted by an options change.
- Optional pH gate: when a zone configures a pH sensor (`ph_entity_id`) and a
  `[ph_min, ph_max]` range, SCHEDULED runs only start while the sensor reads
  inside that range. It is fail-safe: a missing, unavailable, unparseable or
  non-finite (`NaN`/`Infinity`) reading blocks the run rather than watering
  blindly, and the skipped schedule is flagged with a warning until it next
  waters successfully. `water_now` is always an explicit manual override and
  ignores the gate. `set_zone_options` validates `ph_min <= ph_max` against
  the EFFECTIVE stored range, not just the fields sent in a single call, so a
  partial update can't silently invert it. A zone may ALSO configure a
  second, fully independent reservoir (`ph_entity_id_2`/`ph_min_2`/
  `ph_max_2`) — e.g. a single pump/outlet feeding two physically separate
  tanks, each with its own pH. When configured, a scheduled run only starts
  if BOTH reservoirs pass their own gate; the first one that fails blocks
  the run, and its warning names which reservoir (R1/R2) did.
- A corrupted runtime Store or schedule (e.g. a non-numeric `duration`) is
  handled defensively instead of crashing the zone's setup or silently
  stopping it from ever scheduling again: invalid schedules are filtered out
  (logged), and a resumed run re-verifies the target is actually actuated
  instead of trusting the Store blindly.
- The 30-day run history only records runs that actually delivered water: a
  run whose target never actuated (confirmed by the actuation-grace check or
  a restart recovery that found it still off) is never logged.

## Development

### Backend tests (pure, no HA needed)

```bash
pip install -r requirements-test.txt
python -m pytest tests/test_next_run.py tests/test_schedules.py
```

### Integration tests (with Home Assistant)

These run against a real HA in a venv (Python 3.13, HA 2026.2.3,
`pytest-homeassistant-custom-component`). They need the HA packages installed
and a network-capable test environment.

### Frontend

```bash
cd frontend-src
npm install
npm run typecheck   # tsc --noEmit
npm run test        # vitest (pure logic)
npm run build       # rollup -> custom_components/irrigation_scheduler/frontend/irrigation-schedule-card.js
```

The built card JS is committed to the repository (required for HACS). After
changing frontend sources, rebuild and commit the new bundle.
