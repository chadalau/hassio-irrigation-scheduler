import { LitElement, html, TemplateResult } from "lit";
import { property } from "lit/decorators.js";

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

  @property({ attribute: false })
  public config?: CardConfig;

  protected render(): TemplateResult {
    if (!this.hass || !this.config) {
      return html``;
    }
    return html`
      <ha-form
        .hass=${this.hass}
        .data=${this.config}
        .schema=${SCHEMA}
        .computeLabel=${this._computeLabel}
        @value-changed=${this._valueChanged}
      ></ha-form>
    `;
  }

  private _computeLabel = (schema: FormSchema): string =>
    LABELS[schema.name] ?? schema.name;

  private _valueChanged(ev: CustomEvent): void {
    const detail = ev.detail as { name?: string; value?: unknown } | undefined;
    const name = detail?.name;
    if (!name || !this.config) {
      return;
    }
    const config = { ...this.config, [name]: detail.value } as CardConfig;
    this.dispatchEvent(
      new CustomEvent("config-changed", {
        detail: { config },
        bubbles: true,
        composed: true,
      }),
    );
  }
}
