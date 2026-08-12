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
  switch_entity_id?: string;
  binary_sensor_entity_id?: string;
}

/** Attributes of the binary_sensor.<zone>_watering entity (contract). */
export interface WateringAttributes extends Record<string, unknown> {
  started_at?: string;
  finishes_at?: string;
  duration?: number;
  source?: string;
  schedule_id?: string;
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
