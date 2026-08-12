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

The card shows:

- the zone name and a master toggle (the `switch.<zone>_schedule_enabled`);
- a live countdown bar while watering (computed client-side from
  `finishes_at`, no backend polling) with a **Parar** button;
- the next scheduled run;
- the list of schedules (time, day chips, duration) with per-schedule
  enable/disable, edit and delete;
- an **Adicionar horário** dialog (time, days, duration);
- a **Regar agora** button (uses the zone's default duration).

The card works in Portuguese by default and adapts to the HA locale when
available.

## Entities (per zone, one device)

| Entity | Purpose |
|---|---|
| `switch.<zone>_schedule_enabled` | Enables/disables the whole schedule of the zone. |
| `sensor.<zone>_next_run` | Next scheduled run (timestamp). Attributes: `schedules`, `target_entity_id`, `default_duration`, `max_duration`, `switch_entity_id`, `binary_sensor_entity_id`. |
| `binary_sensor.<zone>_watering` | Reports whether the zone is watering. Attributes: `started_at`, `finishes_at`, `duration`, `source`, `schedule_id`. |

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
