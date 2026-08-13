import { LitElement, html, TemplateResult } from "lit";
import { property, state } from "lit/decorators.js";

import type { CardConfig, HomeAssistant } from "./types";

interface FormSchema {
  name: string;
  selector: Record<string, unknown>;
}

const SCHEMA: FormSchema[] = [
  { name: "entity", selector: { entity: { domain: "sensor" } } },
  { name: "name", selector: { text: {} } },
  { name: "show_next_run", selector: { boolean: {} } },
  { name: "show_water_now", selector: { boolean: {} } },
  { name: "compact", selector: { boolean: {} } },
];

const LABELS: Record<string, string> = {
  entity: "Entidade (sensor.<zona>_next_run)",
  name: "Nome",
  show_next_run: "Mostrar próximo horário",
  show_water_now: "Mostrar regar agora",
  compact: "Compacto",
};

export class IrrigationScheduleCardEditor extends LitElement {
  @property({ attribute: false })
  public hass?: HomeAssistant;

  @state()
  private _config?: CardConfig;

  /**
   * Required by the Lovelace card-editor contract: the dashboard host calls
   * this to hand over the config (it does NOT set a `.config` property
   * directly). Without it the host's own `this._configElement.setConfig(...)`
   * call throws "setConfig is not a function" and the visual editor never
   * loads (YAML-only fallback).
   */
  setConfig(config: CardConfig): void {
    this._config = config;
  }

  protected render(): TemplateResult {
    if (!this.hass || !this._config) {
      return html``;
    }
    return html`
      <ha-form
        .hass=${this.hass}
        .data=${this._config}
        .schema=${SCHEMA}
        .computeLabel=${this._computeLabel}
        @value-changed=${this._valueChanged}
      ></ha-form>
    `;
  }

  private _computeLabel = (schema: FormSchema): string =>
    LABELS[schema.name] ?? schema.name;

  /**
   * ha-form's own `value-changed` event carries the ENTIRE form data as
   * `detail.value` (it consolidates every field's change into one event
   * before re-firing, not a per-field `{ name, value }` pair) -- reading
   * `detail.name` here always returned `undefined`, so `config-changed` was
   * never dispatched and the visual editor silently saved nothing (only
   * editing the card's YAML worked).
   */
  private _valueChanged(ev: CustomEvent): void {
    const value = (ev.detail as { value?: Record<string, unknown> } | undefined)
      ?.value;
    if (!value || !this._config) {
      return;
    }
    const config = { ...this._config, ...value } as CardConfig;
    this.dispatchEvent(
      new CustomEvent("config-changed", {
        detail: { config },
        bubbles: true,
        composed: true,
      }),
    );
  }
}
