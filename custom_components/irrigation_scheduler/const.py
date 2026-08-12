"""Constants for the Irrigation Scheduler integration."""

from __future__ import annotations

from homeassistant.const import Platform

DOMAIN = "irrigation_scheduler"
NAME = "Irrigation Scheduler"

# Config entry data / options keys.
CONF_NAME = "name"
CONF_TARGET_ENTITY_ID = "target_entity_id"
CONF_ENABLED = "enabled"
CONF_DEFAULT_DURATION = "default_duration"
CONF_MAX_DURATION = "max_duration"
CONF_SCHEDULES = "schedules"

# Schedule keys.
CONF_SCHEDULE_ID = "id"
CONF_SCHEDULE_TIME = "time"
CONF_SCHEDULE_DAYS = "days"
CONF_SCHEDULE_DURATION = "duration"

# Defaults (all durations in seconds).
DEFAULT_ENABLED = True
DEFAULT_DEFAULT_DURATION = 600
DEFAULT_MAX_DURATION = 7200
MIN_DURATION = 1
MAX_SCHEDULE_DURATION = 86400

# Grace period (seconds) granted to a target after a turn_on command before we
# verify it actually left its off state. Real devices (Z-Wave, Zigbee, MQTT,
# motorized valves) are ASYNC: the service returns as soon as the command is
# dispatched and the entity state catches up seconds later. The actual wait is
# ``min(ACTUATION_GRACE, run_duration)`` so a very short run is never delayed
# beyond its own end.
ACTUATION_GRACE = 15

# Dispatcher signal sent to all entities of an entry whenever the scheduler
# state changes (watering started/stopped, next run moved, options changed).
SIGNAL_UPDATE = "irrigation_scheduler_update_{entry_id}"

# Runtime (volatile) state storage.
STORE_KEY = "irrigation_scheduler.runtime"
STORE_VERSION = 1

# Sources for a watering run.
SOURCE_SCHEDULE = "schedule"
SOURCE_MANUAL = "manual"

# Service names.
SERVICE_WATER_NOW = "water_now"
SERVICE_STOP = "stop"
SERVICE_ADD_SCHEDULE = "add_schedule"
SERVICE_UPDATE_SCHEDULE = "update_schedule"
SERVICE_REMOVE_SCHEDULE = "remove_schedule"
SERVICE_SET_SCHEDULES = "set_schedules"

# Frontend (Onda B1): the card JS is served as a static path and registered as
# an extra module URL so Lovelace can load it. The card itself (Lit/TS) is
# Onda B2 and replaces the placeholder file.
CARD_JS_URL = "/irrigation_scheduler/card.js"
CARD_JS_FILENAME = "irrigation-schedule-card.js"

PLATFORMS: list[Platform] = [
    Platform.SWITCH,
    Platform.SENSOR,
    Platform.BINARY_SENSOR,
]
