import { LitElement, html, PropertyValues, TemplateResult } from "lit";
import { property, state } from "lit/decorators.js";

import {
  DAY_MAX,
  DAY_MIN,
  DEFAULT_COMPACT,
  DEFAULT_SHOW_NEXT_RUN,
  DEFAULT_SHOW_WATER_NOW,
  DOMAIN,
} from "./const";
import { IrrigationScheduleCardEditor } from "./editor";
import { cardStyles } from "./styles";
import {
  dayLabels,
  formatDuration,
  formatRemaining,
  formatTime,
  progressPct,
  remainingSeconds,
  sanitizeSchedules,
  timeToSeconds,
  toServiceTime,
} from "./utils";
import type {
  CardConfig,
  HassEntity,
  HomeAssistant,
  Schedule,
} from "./types";

/** Minimal shape for elements exposing a `checked` property. */
interface CheckableElement extends HTMLElement {
  checked: boolean;
}

/**
 * Validate the Lovelace card config. Throws explicit pt-BR messages so the
 * card fails fast at `setConfig` time instead of only at render time.
 */
export function validateCardConfig(config: unknown): void {
  if (!config || typeof config !== "object") {
    throw new Error("Configuração inválida para o card de irrigação.");
  }
  const entity = (config as { entity?: unknown }).entity;
  if (
    typeof entity !== "string" ||
    entity.length === 0 ||
    !entity.startsWith("sensor.")
  ) {
    throw new Error(
      'O card exige um sensor da integração: "sensor.<zona>_next_run".',
    );
  }
}

export class IrrigationScheduleCard extends LitElement {
  @property({ attribute: false })
  public hass?: HomeAssistant;

  @state()
  private _config: CardConfig = { type: "custom:irrigation-schedule-card" };

  @state()
  private _now = 0;

  @state()
  private _dialogOpen = false;

  @state()
  private _editingId: string | null = null;

  @state()
  private _formTime = "06:00";

  @state()
  private _formDays: number[] = [];

  @state()
  private _formDurationMin = 15;

  @state()
  private _formDurationSec = 0;

  @state()
  private _formError = false;

  private _tickerId: number | null = null;

  static styles = cardStyles;

  static getConfigElement(): HTMLElement {
    return document.createElement("irrigation-schedule-card-editor");
  }

  static getStubConfig(): Partial<CardConfig> {
    return {
      show_next_run: DEFAULT_SHOW_NEXT_RUN,
      show_water_now: DEFAULT_SHOW_WATER_NOW,
      compact: DEFAULT_COMPACT,
    };
  }

  setConfig(config: CardConfig): void {
    validateCardConfig(config);
    this._config = { ...config };
  }

  getCardSize(): number {
    return this._config.compact ? 2 : 4;
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this._stopTicker();
  }

  protected updated(changed: PropertyValues): void {
    super.updated(changed);
    if (this._isWatering()) {
      if (this._tickerId === null) {
        this._tickerId = window.setInterval(() => {
          this._now = Date.now();
        }, 1000);
      }
    } else if (this._tickerId !== null) {
      this._stopTicker();
    }
  }

  protected render(): TemplateResult {
    if (!this.hass) {
      return this._renderConfigError(
        "O card ainda não recebeu o objeto hass do Home Assistant.",
      );
    }
    try {
      if (!this._config.entity) {
        return this._renderConfigError(
          "Configure o card com o sensor da zona: sensor.<zona>_next_run.",
        );
      }
      if (!this._config.entity.startsWith("sensor.")) {
        return this._renderConfigError(
          `"${this._config.entity}" não é um sensor da integração irrigation_scheduler.`,
        );
      }
      const sensor = this._sensorEntity;
      if (!sensor) {
        return this._renderConfigError(
          `Entidade "${this._config.entity}" não encontrada.`,
        );
      }
      return this._renderCard(sensor);
    } catch (error) {
      console.error("[irrigation-schedule-card] render failed", error);
      return this._renderConfigError(
        `Falha ao renderizar o card: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  // ------------------------------------------------------------------
  // Sections
  // ------------------------------------------------------------------

  private _renderConfigError(message: string): TemplateResult {
    return html`
      <ha-card>
        <div class="config-error">
          <ha-icon icon="mdi:alert-outline"></ha-icon>
          <div>${message}</div>
        </div>
      </ha-card>
    `;
  }

  private _renderCard(sensor: HassEntity): TemplateResult {
    const compact = this._config.compact ?? DEFAULT_COMPACT;
    const showNextRun = this._config.show_next_run ?? DEFAULT_SHOW_NEXT_RUN;
    const showWaterNow = this._config.show_water_now ?? DEFAULT_SHOW_WATER_NOW;
    const locale = this._locale();
    const labels = dayLabels(locale);
    const schedules = sanitizeSchedules(sensor.attributes.schedules);
    const defaultDuration = this._numberAttr(sensor, "default_duration") ?? 0;
    const switchEntity = this._switchEid
      ? this.hass?.states[this._switchEid]
      : undefined;
    const binaryEntity = this._binarySensorEid
      ? this.hass?.states[this._binarySensorEid]
      : undefined;
    const wateringOn = binaryEntity?.state === "on";
    const switchOn = switchEntity?.state === "on";

    const statusText = wateringOn
      ? "Regando"
      : switchOn
        ? "Agendada"
        : "Desabilitada";
    const statusClass = wateringOn
      ? "status-watering"
      : switchOn
        ? "status-scheduled"
        : "status-disabled";

    const finishesAt = this._stringAttr(binaryEntity, "finishes_at");
    const startedAt = this._stringAttr(binaryEntity, "started_at");
    const nowIso =
      this._now > 0 ? new Date(this._now).toISOString() : new Date().toISOString();
    const remaining = finishesAt ? remainingSeconds(finishesAt, nowIso) : 0;
    const progress =
      startedAt && finishesAt ? progressPct(finishesAt, startedAt, nowIso) : 0;

    const waterNowLabel =
      defaultDuration > 0
        ? `Regar agora por ${formatDuration(defaultDuration)}`
        : "Regar agora";

    return html`
      <ha-card class=${compact ? "compact" : ""}>
        <div class="header">
          <div class="header-title" title=${this._config.entity ?? ""}>
            ${this._zoneName(sensor)}
          </div>
          <div class="header-right">
            <span class="status ${statusClass}">${statusText}</span>
            ${switchEntity
              ? html`
                  <ha-entity-toggle
                    .hass=${this.hass}
                    .entity=${switchEntity}
                  ></ha-entity-toggle>
                `
              : html`<ha-switch disabled></ha-switch>`}
          </div>
        </div>

        ${wateringOn && finishesAt
          ? html`
              <div class="watering-bar">
                <div class="watering-info">
                  <div class="watering-left">
                    <ha-icon icon="mdi:sprinkler-variant"></ha-icon>
                    <span>Regando</span>
                  </div>
                  <div class="watering-remaining">
                    ${formatRemaining(remaining)}
                  </div>
                </div>
                <div class="progress-track">
                  <div
                    class="progress-fill"
                    style="width: ${progress}%"
                  ></div>
                </div>
                <div class="watering-actions">
                  <ha-button outlined @click=${this._stopWatering}>
                    <ha-icon icon="mdi:stop"></ha-icon>
                    Parar
                  </ha-button>
                </div>
              </div>
            `
          : ""}

        ${!wateringOn && showNextRun
          ? html`
              <div class="next-run">
                <ha-icon icon="mdi:clock-start"></ha-icon>
                <span>Próximo: ${this._nextRunText(sensor.state, locale)}</span>
              </div>
            `
          : ""}

        <div class="card-body">
          <div class="schedules">
            ${schedules.length === 0
              ? html`<div class="empty">Nenhum horário configurado.</div>`
              : schedules.map((schedule) =>
                  this._renderScheduleRow(schedule, labels),
                )}
          </div>

          <div class="actions">
            <ha-button outlined @click=${this._openAdd}>
              <ha-icon icon="mdi:plus"></ha-icon>
              Adicionar horário
            </ha-button>
            ${showWaterNow
              ? html`
                  <ha-button
                    raised
                    ?disabled=${wateringOn}
                    @click=${this._waterNow}
                  >
                    ${waterNowLabel}
                  </ha-button>
                `
              : ""}
          </div>
        </div>
      </ha-card>

      ${this._renderDialog(labels)}
    `;
  }

  private _renderScheduleRow(schedule: Schedule, labels: string[]): TemplateResult {
    return html`
      <div class="schedule-row">
        <div class="schedule-time">${formatTime(schedule.time)}</div>
        <div class="schedule-days">
          ${schedule.days.map(
            (day) => html`<span class="day-chip">${labels[day] ?? ""}</span>`,
          )}
        </div>
        <div class="schedule-duration">
          ${formatDuration(schedule.duration)}
        </div>
        <ha-switch
          ?checked=${schedule.enabled}
          @change=${(ev: Event) => this._toggleScheduleEnabled(schedule, ev)}
        ></ha-switch>
        <div class="schedule-actions">
          <ha-icon-button
            title="Editar"
            @click=${() => this._openEdit(schedule)}
          >
            <ha-icon icon="mdi:pencil"></ha-icon>
          </ha-icon-button>
          <ha-icon-button
            title="Excluir"
            @click=${() => this._deleteSchedule(schedule)}
          >
            <ha-icon icon="mdi:delete"></ha-icon>
          </ha-icon-button>
        </div>
      </div>
    `;
  }

  private _renderDialog(labels: string[]): TemplateResult {
    if (!this._dialogOpen) {
      return html``;
    }
    return html`
      <div class="overlay" @click=${this._closeDialog}>
        <div
          class="dialog"
          role="dialog"
          aria-modal="true"
          @click=${(ev: Event) => ev.stopPropagation()}
        >
          <div class="dialog-header">
            ${this._editingId ? "Editar horário" : "Adicionar horário"}
          </div>
          <div class="dialog-body">
            <div class="field">
              <label>Horário</label>
              <input
                type="time"
                .value=${this._formTime}
                @change=${this._onTimeChanged}
              />
            </div>
            <div class="field">
              <label>Dias da semana</label>
              <div class="day-picker">
                ${labels.map(
                  (label, day) => html`
                    <label class="day-option">
                      <input
                        type="checkbox"
                        ?checked=${this._formDays.includes(day)}
                        @change=${(ev: Event) => this._toggleDay(day, ev)}
                      />
                      <span>${label}</span>
                    </label>
                  `,
                )}
              </div>
            </div>
            <div class="field">
              <label>Duração</label>
              <div class="duration-row">
                <div class="duration-part">
                  <input
                    type="number"
                    min="0"
                    .value=${String(this._formDurationMin)}
                    @change=${this._onDurationMinChange}
                  />
                  <span>min</span>
                </div>
                <div class="duration-part">
                  <input
                    type="number"
                    min="0"
                    max="59"
                    .value=${String(this._formDurationSec)}
                    @change=${this._onDurationSecChange}
                  />
                  <span>seg</span>
                </div>
              </div>
            </div>
            ${this._formError
              ? html`
                  <div class="form-error">
                    Informe um horário, ao menos um dia e uma duração válida.
                  </div>
                `
              : ""}
          </div>
          <div class="dialog-actions">
            <button class="dialog-cancel" @click=${this._closeDialog}>
              Cancelar
            </button>
            <button class="dialog-save" @click=${this._saveDialog}>Salvar</button>
          </div>
        </div>
      </div>
    `;
  }

  // ------------------------------------------------------------------
  // Entity access
  // ------------------------------------------------------------------

  private get _sensorEntity(): HassEntity | undefined {
    const id = this._config.entity;
    return id ? this.hass?.states[id] : undefined;
  }

  private get _switchEid(): string | undefined {
    return this._stringAttr(this._sensorEntity, "switch_entity_id");
  }

  private get _binarySensorEid(): string | undefined {
    return this._stringAttr(this._sensorEntity, "binary_sensor_entity_id");
  }

  private _isWatering(): boolean {
    const id = this._binarySensorEid;
    return id ? this.hass?.states[id]?.state === "on" : false;
  }

  private _stringAttr(
    entity: HassEntity | undefined,
    name: string,
  ): string | undefined {
    const value = entity?.attributes[name];
    return typeof value === "string" && value ? value : undefined;
  }

  private _numberAttr(entity: HassEntity | undefined, name: string): number | undefined {
    const value = entity?.attributes[name];
    return typeof value === "number" && Number.isFinite(value) ? value : undefined;
  }

  private _zoneName(sensor: HassEntity): string {
    const configured = this._config.name;
    if (configured && configured.trim()) {
      return configured;
    }
    const friendly = this._stringAttr(sensor, "friendly_name");
    if (!friendly) {
      return this._config.entity ?? "";
    }
    const suffixes = [
      " próxima execução",
      " next run",
      " próximo horário",
      " proximo horario",
    ];
    for (const suffix of suffixes) {
      if (friendly.toLowerCase().endsWith(suffix)) {
        return friendly.slice(0, friendly.length - suffix.length).trim();
      }
    }
    return friendly;
  }

  private _locale(): string {
    return this.hass?.locale?.language || this.hass?.language || "pt-BR";
  }

  private _nextRunText(state: string, locale: string): string {
    const date = new Date(state);
    if (!state || Number.isNaN(date.getTime())) {
      return "Nenhum horário agendado";
    }
    return new Intl.DateTimeFormat(locale, {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  }

  // ------------------------------------------------------------------
  // Ticker
  // ------------------------------------------------------------------

  private _stopTicker(): void {
    if (this._tickerId !== null) {
      window.clearInterval(this._tickerId);
      this._tickerId = null;
    }
    this._now = 0;
  }

  // ------------------------------------------------------------------
  // Actions
  // ------------------------------------------------------------------

  private _callService(service: string, data: Record<string, unknown> = {}): void {
    if (!this.hass) {
      return;
    }
    const entityId = this._config.entity;
    if (!entityId) {
      return;
    }
    void this.hass
      .callService(DOMAIN, service, data, { entity_id: entityId })
      .catch((error: unknown) => {
        console.error(`[irrigation-schedule-card] ${DOMAIN}.${service} failed`, error);
      });
  }

  private _waterNow(): void {
    this._callService("water_now");
  }

  private _stopWatering(): void {
    this._callService("stop");
  }

  private _toggleScheduleEnabled(schedule: Schedule, ev: Event): void {
    const checked = (ev.target as CheckableElement).checked;
    this._callService("update_schedule", { id: schedule.id, enabled: checked });
  }

  private _deleteSchedule(schedule: Schedule): void {
    if (window.confirm(`Excluir o horário das ${formatTime(schedule.time)}?`)) {
      this._callService("remove_schedule", { id: schedule.id });
    }
  }

  // ------------------------------------------------------------------
  // Dialog
  // ------------------------------------------------------------------

  private _openAdd(): void {
    this._editingId = null;
    this._formTime = "06:00";
    this._formDays = [];
    this._formDurationMin = this._defaultDurationMinutes();
    this._formDurationSec = 0;
    this._formError = false;
    this._dialogOpen = true;
  }

  private _openEdit(schedule: Schedule): void {
    this._editingId = schedule.id;
    this._formTime = formatTime(schedule.time);
    this._formDays = [...schedule.days];
    const total = Math.max(1, Math.round(schedule.duration));
    this._formDurationMin = Math.floor(total / 60);
    this._formDurationSec = total % 60;
    this._formError = false;
    this._dialogOpen = true;
  }

  private _closeDialog(): void {
    this._dialogOpen = false;
    this._editingId = null;
    this._formError = false;
  }

  private _saveDialog(): void {
    const time = toServiceTime(this._formTime);
    const days = [...this._formDays].sort((a, b) => a - b);
    const duration = this._formDurationMin * 60 + this._formDurationSec;
    if (timeToSeconds(time) < 0 || days.length === 0 || duration <= 0) {
      this._formError = true;
      return;
    }
    if (this._editingId) {
      this._callService("update_schedule", { id: this._editingId, time, days, duration });
    } else {
      this._callService("add_schedule", { time, days, duration, enabled: true });
    }
    this._closeDialog();
  }

  private _onTimeChanged(ev: Event): void {
    const value = (ev.target as HTMLInputElement).value;
    if (typeof value === "string") {
      this._formTime = value;
      this._formError = false;
    }
  }

  private _toggleDay(day: number, ev: Event): void {
    if (day < DAY_MIN || day > DAY_MAX) {
      return;
    }
    const checked = (ev.target as CheckableElement).checked;
    this._formDays = checked
      ? [...this._formDays, day]
      : this._formDays.filter((d) => d !== day);
    this._formError = false;
  }

  private _onDurationMinChange(ev: Event): void {
    const raw = (ev.target as HTMLInputElement).value;
    const parsed = Number.parseInt(raw, 10);
    this._formDurationMin = Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
    this._formError = false;
  }

  private _onDurationSecChange(ev: Event): void {
    const raw = (ev.target as HTMLInputElement).value;
    const parsed = Number.parseInt(raw, 10);
    const clamped =
      Number.isFinite(parsed) && parsed >= 0
        ? Math.min(59, parsed)
        : 0;
    this._formDurationSec = clamped;
    this._formError = false;
  }

  private _defaultDurationMinutes(): number {
    const seconds = this._numberAttr(this._sensorEntity, "default_duration");
    if (!seconds || seconds < 60) {
      return 15;
    }
    return Math.max(1, Math.round(seconds / 60));
  }
}

// ------------------------------------------------------------------
// Registration (single place; guarded against double-registration)
// ------------------------------------------------------------------
if (!customElements.get("irrigation-schedule-card")) {
  customElements.define("irrigation-schedule-card", IrrigationScheduleCard);
}
if (!customElements.get("irrigation-schedule-card-editor")) {
  customElements.define(
    "irrigation-schedule-card-editor",
    IrrigationScheduleCardEditor,
  );
}

window.customCards = window.customCards || [];
if (!window.customCards.some((card) => card.type === "irrigation-schedule-card")) {
  window.customCards.push({
    type: "irrigation-schedule-card",
    name: "Irrigation Scheduler",
    description:
      "Controle e agende a irrigação de uma zona (irrigation_scheduler).",
    preview: false,
  });
}
