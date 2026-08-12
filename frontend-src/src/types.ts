/** Shape of one entity state in `hass.states`. */
export interface HassEntity {
  entity_id: string;
  state: string;
  last_changed: string;
  last_updated: string;
  attributes: Record<string, unknown>;
}

export type HassEntities = Record<string, HassEntity>;

export interface ServiceTarget {
  entity_id?: string | string[];
  device_id?: string | string[];
  area_id?: string | string[];
}

/**
 * Minimal structural type of the `hass` object Home Assistant injects into
 * cards. It is rebuilt on every entity change, so `states` is reactive.
 */
export interface HomeAssistant {
  language: string;
  locale?: {
    language?: string;
    number_format?: string;
    time_format?: string;
    [key: string]: unknown;
  };
  /** Server-side config; `time_zone` is the HA instance's configured zone
   * (e.g. "America/Sao_Paulo"), used so dates render in the SERVER's zone
   * instead of whatever zone the viewing browser happens to be in. */
  config?: {
    time_zone?: string;
    [key: string]: unknown;
  };
  states: HassEntities;
  callService(
    domain: string,
    service: string,
    serviceData?: Record<string, unknown>,
    target?: ServiceTarget,
  ): Promise<void>;
}

/** One irrigation schedule as exposed in the sensor attributes (contract). */
export interface Schedule {
  id: string;
  /** "HH:MM:SS" */
  time: string;
  /** Days of the week, 0 = Monday ... 6 = Sunday. */
  days: number[];
  /** Duration in seconds. */
  duration: number;
  enabled: boolean;
}

/** The Lovelace card YAML config. */
export interface CardConfig {
  type: string;
  /** The target next_run sensor entity id (sensor.<zone>_next_run). */
  entity?: string;
  name?: string | null;
  show_next_run?: boolean;
  show_water_now?: boolean;
  compact?: boolean;
}

/** Attributes of the sensor.<zone>_next_run entity (contract). */
export interface NextRunAttributes extends Record<string, unknown> {
  schedules?: unknown;
  target_entity_id?: string;
  default_duration?: number;
  max_duration?: number;
  flow_rate_lph?: number;
  number_of_pots?: number;
  reservoir_volume_l?: number;
  /** Tracked remaining volume; defaults to reservoir_volume_l when absent
   * (matches the backend's "full capacity" default for a never-set zone). */
  reservoir_remaining_l?: number;
  ph_entity_id?: string;
  ph_min?: number;
  ph_max?: number;
  /** Display-only: never gates a run, only feeds the card's EC badge. */
  ec_entity_id?: string;
  /** Second, independent reservoir (e.g. one pump feeding two tanks). Fully
   * optional; when set, a scheduled run only starts if BOTH R1 and R2 read
   * within their own range. */
  ph_entity_id_2?: string;
  ph_min_2?: number;
  ph_max_2?: number;
  ec_entity_id_2?: string;
  /** schedule id -> reason text, present while a scheduled fire was skipped by the pH gate. */
  schedule_warnings?: Record<string, string>;
  switch_entity_id?: string;
  binary_sensor_entity_id?: string;
}

/** One completed watering run in the 30-day history log (contract). */
export interface HistoryRun {
  started_at: string;
  finishes_at: string;
  /** ACTUAL seconds watered (a run stopped early logs less than requested). */
  duration: number;
  source: string | null;
  schedule_id: string | null;
  /** Snapshotted AT THE TIME of the run, so historical volume stays
   * accurate even if these zone settings change later. */
  flow_rate_lph: number;
  number_of_pots: number;
  /** pH/EC reading AT RUN START, or null if not configured/unavailable. */
  ph_value: number | null;
  ec_value: number | null;
  /** EC's unit varies by sensor (µS/cm, mS/cm, ...); pH has none (always
   * displayed with a fixed "PH" suffix, see the header badge). */
  ec_unit: string | null;
  /** Second reservoir's pH/EC, snapshotted the same way as the fields above. */
  ph_value_2: number | null;
  ec_value_2: number | null;
  ec_unit_2: string | null;
}

/** Attributes of the binary_sensor.<zone>_watering entity (contract). */
export interface WateringAttributes extends Record<string, unknown> {
  started_at?: string;
  finishes_at?: string;
  duration?: number;
  source?: string;
  schedule_id?: string;
  last_run?: HistoryRun | null;
  history?: HistoryRun[];
}

declare global {
  interface Window {
    customCards?: Array<{
      type: string;
      name: string;
      description: string;
      preview?: boolean;
    }>;
  }
}
