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
  averageDailyVolumeL,
  countSchedulesToday,
  dayInitials,
  dayLabelFor,
  dayLabels,
  durationSecondsForPerPotVolumeMl,
  formatDuration,
  formatMl,
  formatRemaining,
  formatReservoirEstimate,
  formatSensorReading,
  formatTime,
  formatVolume,
  formatVolumeFraction,
  groupHistoryByDay,
  perPotVolumeMl,
  progressPct,
  remainingSeconds,
  sanitizeSchedules,
  scheduleStatusToday,
  sortSchedulesByTime,
  sourceIcon,
  sourceLabel,
  timeToSeconds,
  toServiceTime,
  totalVolumeMl,
} from "./utils";
import type { HistoryDayGroup } from "./utils";
import type {
  CardConfig,
  HassEntity,
  HistoryRun,
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
  private _historyOpen = false;

  @state()
  private _settingsOpen = false;

  private _focusBeforeDialog: HTMLElement | null = null;

  @state()
  private _settingsDefaultDuration = "";

  @state()
  private _settingsFlow = "";

  @state()
  private _settingsPots = "";

  @state()
  private _settingsReservoir = "";

  @state()
  private _settingsPhEntity = "";

  /**
   * Whether the pH-entity field was actually edited this session. An empty
   * string is a meaningful, explicit value (disables the gate) distinct from
   * "the field was never touched" (leave the stored entity id unchanged) --
   * both look identical as a bare string, so a separate flag is required.
   */
  private _settingsPhEntityTouched = false;

  @state()
  private _settingsPhMin = "";

  @state()
  private _settingsPhMax = "";

  @state()
  private _settingsEcEntity = "";

  /** Same reasoning as `_settingsPhEntityTouched`, for the EC field. */
  private _settingsEcEntityTouched = false;

  @state()
  private _settingsPhEntity2 = "";

  /** Same reasoning as `_settingsPhEntityTouched`, for the R2 pH field. */
  private _settingsPhEntity2Touched = false;

  @state()
  private _settingsPhMin2 = "";

  @state()
  private _settingsPhMax2 = "";

  @state()
  private _settingsEcEntity2 = "";

  /** Same reasoning as `_settingsPhEntityTouched`, for the R2 EC field. */
  private _settingsEcEntity2Touched = false;

  @state()
  private _settingsError: string | null = null;

  @state()
  private _editingId: string | null = null;

  @state()
  private _formTime = "00:00";

  @state()
  private _formDays: number[] = [];

  @state()
  private _formDurationHour = 0;

  @state()
  private _formDurationMin = 0;

  @state()
  private _formDurationSec = 0;

  @state()
  private _formError: string | null = null;

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

  connectedCallback(): void {
    super.connectedCallback();
    // Reattaching the SAME element (a dashboard re-layout, a view switched
    // away from and back) does not by itself re-render, and the ticker only
    // ever started from `updated()`. Without this the countdown and progress
    // bar stayed frozen at whatever second the element was detached, until
    // some unrelated Home Assistant update happened to come in.
    this._startTicker();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this._stopTicker();
  }

  protected updated(changed: PropertyValues): void {
    super.updated(changed);
    if (this._isWatering()) {
      this._startTicker();
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
      // The "sensor." prefix alone does not prove this is one of OUR
      // next_run sensors: any HA sensor matches it. Require the
      // integration's own contract attributes (present even before both
      // sibling entities resolve -- they start as null, not undefined).
      if (
        !("switch_entity_id" in sensor.attributes) ||
        !("binary_sensor_entity_id" in sensor.attributes)
      ) {
        return this._renderConfigError(
          `"${this._config.entity}" não é um sensor da integração irrigation_scheduler.`,
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
    const labels = dayLabels();
    const schedules = sortSchedulesByTime(sanitizeSchedules(sensor.attributes.schedules));
    const defaultDurationSec = this._numberAttr(sensor, "default_duration") ?? 600;
    const flowRate = this._numberAttr(sensor, "flow_rate_lph") ?? 0;
    const numberOfPots = this._numberAttr(sensor, "number_of_pots") ?? 0;
    const reservoirVolume = this._numberAttr(sensor, "reservoir_volume_l") ?? 0;
    const reservoirRemaining =
      this._numberAttr(sensor, "reservoir_remaining_l") ?? reservoirVolume;
    const phEntityId = this._stringAttr(sensor, "ph_entity_id") ?? "";
    const phMin = this._numberAttr(sensor, "ph_min") ?? 0;
    const phMax = this._numberAttr(sensor, "ph_max") ?? 14;
    const phStatusClass = this._phStatusClass(phEntityId, phMin, phMax);
    const ecEntityId = this._stringAttr(sensor, "ec_entity_id") ?? "";
    const phEntityId2 = this._stringAttr(sensor, "ph_entity_id_2") ?? "";
    const phMin2 = this._numberAttr(sensor, "ph_min_2") ?? 0;
    const phMax2 = this._numberAttr(sensor, "ph_max_2") ?? 14;
    const phStatusClass2 = this._phStatusClass(phEntityId2, phMin2, phMax2);
    const ecEntityId2 = this._stringAttr(sensor, "ec_entity_id_2") ?? "";
    const scheduleWarnings = this._scheduleWarnings(sensor);
    const switchEntity = this._switchEid
      ? this.hass?.states[this._switchEid]
      : undefined;
    const binaryEntity = this._binarySensorEid
      ? this.hass?.states[this._binarySensorEid]
      : undefined;
    const wateringOn = binaryEntity?.state === "on";
    const switchOn = switchEntity?.state === "on";
    // Distinct from `!switchOn`: an absent or unavailable switch entity is
    // UNKNOWN, not off, and must not make the card assert that scheduling is
    // disabled. Only an explicit "off" state does.
    const masterOff = switchEntity?.state === "off";

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
    const statusIcon = wateringOn
      ? "mdi:water"
      : switchOn
        ? "mdi:calendar-check-outline"
        : "mdi:calendar-remove-outline";

    const finishesAt = this._stringAttr(binaryEntity, "finishes_at");
    const startedAt = this._stringAttr(binaryEntity, "started_at");
    const activeSource = this._stringAttr(binaryEntity, "source");
    const nowIso =
      this._now > 0 ? new Date(this._now).toISOString() : new Date().toISOString();
    const remaining = finishesAt ? remainingSeconds(finishesAt, nowIso) : 0;
    const progress =
      startedAt && finishesAt ? progressPct(finishesAt, startedAt, nowIso) : 0;
    const lastRun = this._lastRunAttr(binaryEntity);
    const history = this._historyAttr(binaryEntity);

    const avgDailyVolume = averageDailyVolumeL(schedules, flowRate, numberOfPots);
    const estimateText = formatReservoirEstimate(reservoirRemaining, avgDailyVolume);
    const todayCount = countSchedulesToday(
      schedules,
      nowIso,
      this.hass?.config?.time_zone,
    );
    // Clamped so a stale remaining value above the configured capacity (or a
    // negative one) can never overflow or invert the level bar.
    const reservoirPct =
      reservoirVolume > 0
        ? Math.min(100, Math.max(0, (reservoirRemaining / reservoirVolume) * 100))
        : 0;
    const refillButton =
      reservoirVolume > 0
        ? html`
            <button
              class="refill-button"
              type="button"
              title="Reabastecer reservatório"
              aria-label="Reabastecer reservatório"
              @click=${this._refillReservoir}
            >
              <ha-icon icon="mdi:water-plus"></ha-icon>
            </button>
          `
        : "";
    // R1's row also carries the (shared) volume/estimate/refill badges, so
    // it must render even without any pH/EC sensor configured -- otherwise
    // a zone with only reservoir_volume_l + flow_rate_lph set would show no
    // reservoir controls at all. R2's row is purely about its own pH/EC:
    // no reservoir fallback there, since the volume controls already show
    // once on R1's row.
    const showRow1 = Boolean(phEntityId || ecEntityId || reservoirVolume > 0);
    const showRow2 = Boolean(phEntityId2 || ecEntityId2);
    const bothReservoirs = showRow1 && showRow2;
    const headline = wateringOn
      ? "Regando agora"
      : masterOff
        ? "Agendamento desativado"
        : todayCount === 1
          ? "1 horário hoje"
          : `${todayCount} horários hoje`;
    const contextText =
      wateringOn && finishesAt
        ? `${formatRemaining(remaining)} restantes`
        : !masterOff && showNextRun
          ? `Próxima: ${this._nextRunText(sensor.state)}`
          : "";
    const summaryLabel =
      reservoirVolume > 0
        ? "Reservatório"
        : avgDailyVolume > 0
          ? "Volume/dia"
          : "";
    const summaryValue =
      reservoirVolume > 0
        ? formatVolumeFraction(reservoirRemaining, reservoirVolume)
        : avgDailyVolume > 0
          ? formatVolume(avgDailyVolume)
          : "";
    const reservoirLevelText =
      reservoirVolume > 0
        ? `${Math.round(reservoirPct)}% do reservatório disponível`
        : "Reservatório não configurado";
    return html`
      <ha-card class=${compact ? "compact" : ""}>
        <header class="hero-header header">
          <div class="hero-top">
            <div class="hero-identity">
              <div class="hero-icon zone-icon" aria-hidden="true">
                <ha-icon icon="mdi:water-outline"></ha-icon>
              </div>
              <div class="hero-title-group">
                <span class="hero-eyebrow">Irrigação</span>
                <h2 class="header-title" title=${this._config.entity ?? ""}>
                  ${this._zoneName(sensor)}
                </h2>
              </div>
            </div>

            <div class="hero-actions">
              <span class="status status-chip ${statusClass}">
                <ha-icon icon=${statusIcon}></ha-icon>
                <span>${statusText}</span>
              </span>
              <div class="header-right">
              ${switchEntity
                ? html`
                    <button
                      class="toggle ${switchOn ? "" : "off"}"
                      type="button"
                      role="switch"
                      aria-checked=${switchOn}
                      title=${`Agendamento automático: ${switchOn ? "ativo" : "desativado"}`}
                      aria-label="Agendamento automático"
                      @click=${() => this._toggleMaster(switchEntity, switchOn)}
                    >
                      <span class="track"></span>
                      <span class="thumb"></span>
                    </button>
                  `
                : html`
                    <button
                      class="toggle off"
                      type="button"
                      role="switch"
                      aria-checked="false"
                      title="Agendamento automático: indisponível"
                      aria-label="Agendamento automático (indisponível)"
                      disabled
                    >
                      <span class="track"></span>
                      <span class="thumb"></span>
                    </button>
                  `}
              <button
                class="icon-button"
                type="button"
                title="Configurar vazão e vasos"
                aria-label="Configurar vazão e vasos"
                @click=${this._openSettings}
              >
                <ha-icon icon="mdi:cog-outline"></ha-icon>
              </button>
              </div>
            </div>
          </div>

          <div class="hero-summary summary">
            <div class="hero-kpi summary-main">
              <strong>${headline}</strong>
              ${contextText ? html`<span>${contextText}</span>` : ""}
            </div>
            ${summaryLabel
              ? html`
                  <div class="hero-secondary summary-stat">
                    <span>${summaryLabel}</span>
                    <strong>${summaryValue}</strong>
                  </div>
                `
              : ""}
          </div>

          <div
            class="hero-rail ${reservoirVolume > 0 ? "" : "is-disabled"}"
            role="progressbar"
            aria-label="Nível do reservatório"
            aria-valuemin="0"
            aria-valuemax="100"
            aria-valuenow=${Math.round(reservoirPct)}
            aria-valuetext=${reservoirLevelText}
          >
            <span style="width: ${reservoirPct}%"></span>
          </div>
        </header>

        ${this._renderSettings(
          this._zoneName(sensor),
          defaultDurationSec,
          flowRate,
          numberOfPots,
          reservoirVolume,
          phEntityId,
          phMin,
          phMax,
          ecEntityId,
          phEntityId2,
          phMin2,
          phMax2,
          ecEntityId2,
        )}

        ${lastRun
          ? html`
              <div class="last-run" @click=${this._openHistory}>
                <ha-icon icon="mdi:history"></ha-icon>
                <span>Última rega: ${this._lastRunText(lastRun, nowIso)}</span>
                <span class="schedule-row-spacer"></span>
                <ha-icon class="last-run-chevron" icon="mdi:chevron-right"></ha-icon>
              </div>
            `
          : ""}

        ${showRow1 || showRow2
          ? html`
              <div class="section-divider"></div>
              <div class="card-body">
                ${bothReservoirs
                  ? html`
                      <div class="section-title-row">
                        <h3 class="section-title">Reservatório 1</h3>
                        <h3 class="section-title">Reservatório 2</h3>
                      </div>
                    `
                  : html`<h3 class="section-title">Reservatório</h3>`}
                <div class="metrics">
                  ${bothReservoirs
                    ? html`
                        ${this._renderPhMetric(1, phEntityId, phStatusClass, true) ||
                        html`<span></span>`}
                        ${this._renderPhMetric(2, phEntityId2, phStatusClass2, true) ||
                        html`<span></span>`}
                        ${this._renderEcMetric(1, ecEntityId, true) || html`<span></span>`}
                        ${this._renderEcMetric(2, ecEntityId2, true) || html`<span></span>`}
                      `
                    : html`
                        ${showRow1
                          ? html`
                              ${this._renderPhMetric(1, phEntityId, phStatusClass, false)}
                              ${this._renderEcMetric(1, ecEntityId, false)}
                            `
                          : ""}
                        ${showRow2
                          ? html`
                              ${this._renderPhMetric(2, phEntityId2, phStatusClass2, false)}
                              ${this._renderEcMetric(2, ecEntityId2, false)}
                            `
                          : ""}
                      `}
                </div>
                ${reservoirVolume > 0
                  ? html`
                      <div class="reservoir-level">
                        <div class="reservoir-level-top">
                          <small>
                            Volume${estimateText ? ` · restam ${estimateText}` : ""}
                          </small>
                          <strong>
                            ${formatVolumeFraction(reservoirRemaining, reservoirVolume)}
                          </strong>
                          ${refillButton}
                        </div>
                        <div class="reservoir-level-bar">
                          <div
                            class="reservoir-level-fill"
                            style="width: ${reservoirPct}%"
                          ></div>
                        </div>
                      </div>
                    `
                  : ""}
              </div>
            `
          : ""}

        <div class="section-divider"></div>

        <div class="card-body">
          <h3 class="section-title">Agenda automática</h3>
          <div class="schedules">
            ${schedules.length === 0
              ? html`<div class="empty">Nenhum horário configurado.</div>`
              : schedules.map((schedule) =>
                  this._renderScheduleRow(
                    schedule,
                    flowRate,
                    numberOfPots,
                    scheduleWarnings[schedule.id],
                    history,
                    nowIso,
                    this.hass?.config?.time_zone,
                    masterOff,
                  ),
                )}
          </div>

          <button
            class="add-schedule-button"
            type="button"
            title="Adicionar horário"
            aria-label="Adicionar horário"
            @click=${this._openAdd}
          >
            <ha-icon icon="mdi:plus"></ha-icon>
            Adicionar horário
          </button>

          ${showWaterNow || (wateringOn && finishesAt)
            ? html`
                <div class="actions ${wateringOn && finishesAt ? "watering" : ""}">
                  ${wateringOn && finishesAt
                    ? html`
                        <button
                          class="water-now-button stop"
                          type="button"
                          title="Parar rega"
                          aria-label="Parar rega"
                          @click=${this._stopWatering}
                        >
                          <ha-icon icon="mdi:stop"></ha-icon>
                          Parar
                        </button>
                        <div class="water-now-progress">
                          <div class="water-now-timer">
                            ${formatRemaining(remaining)} restantes${activeSource ===
                            "external"
                              ? ` · ${sourceLabel(activeSource)}`
                              : ""}
                          </div>
                          <div class="progress-track">
                            <div
                              class="progress-fill"
                              style="width: ${progress}%"
                            ></div>
                          </div>
                        </div>
                      `
                    : html`
                        <button
                          class="water-now-button"
                          type="button"
                          title="Regar agora"
                          aria-label="Regar agora"
                          ?disabled=${wateringOn}
                          @click=${this._waterNow}
                        >
                          <ha-icon icon="mdi:play"></ha-icon>
                          Regar agora
                        </button>
                      `}
                </div>
              `
            : ""}
        </div>
      </ha-card>

      ${this._renderDialog(labels, flowRate)}
      ${this._renderHistoryDialog(history, this._zoneName(sensor), nowIso)}
    `;
  }

  /**
   * One pH tile, or "" when this reservoir has no pH sensor -- callers in
   * the two-reservoir grid must substitute an empty placeholder cell of
   * their own instead of using "" directly, or a sensor missing on one
   * reservoir shifts the OTHER reservoir's tiles out of their column (see
   * the `bothReservoirs` branch: pH1, pH2, EC1, EC2 must land in that exact
   * order for the transposed grid to line up). The visible label always
   * reads plain "pH"; with two reservoirs the "Reservatório 2" title in the
   * section header row disambiguates the second column instead.
   * `disambiguate` only affects the tooltip, which has no header to lean on.
   */
  private _renderPhMetric(
    reservoirNumber: 1 | 2,
    phEntityId: string,
    phStatusClass: string,
    disambiguate: boolean,
  ): TemplateResult | "" {
    if (!phEntityId) {
      return "";
    }
    return html`
      <button
        class="metric ph-metric ${phStatusClass}"
        type="button"
        title=${disambiguate
          ? `Ver histórico do pH (reservatório ${reservoirNumber})`
          : "Ver histórico do pH"}
        @click=${() => this._openMoreInfo(phEntityId)}
      >
        <ha-icon icon="mdi:flask"></ha-icon>
        <div class="metric-copy">
          <small>pH</small>
          <strong>
            ${this._sensorBadgeText(phEntityId, "?", (value) =>
              formatSensorReading(value),
            )}
          </strong>
        </div>
      </button>
    `;
  }

  /** Same as `_renderPhMetric`, for EC. */
  private _renderEcMetric(
    reservoirNumber: 1 | 2,
    ecEntityId: string,
    disambiguate: boolean,
  ): TemplateResult | "" {
    if (!ecEntityId) {
      return "";
    }
    return html`
      <button
        class="metric ec-metric"
        type="button"
        title=${disambiguate
          ? `Ver histórico da EC (reservatório ${reservoirNumber})`
          : "Ver histórico da EC"}
        @click=${() => this._openMoreInfo(ecEntityId)}
      >
        <ha-icon icon="mdi:lightning-bolt"></ha-icon>
        <div class="metric-copy">
          <small>EC</small>
          <strong>
            ${this._sensorBadgeText(ecEntityId, "?", (value, unit) =>
              formatSensorReading(value, unit),
            )}
          </strong>
        </div>
      </button>
    `;
  }

  private _renderScheduleRow(
    schedule: Schedule,
    flowRate: number,
    numberOfPots: number,
    warning: string | undefined,
    history: readonly HistoryRun[],
    nowIso: string,
    timeZone: string | undefined,
    masterOff: boolean,
  ): TemplateResult {
    const perPot = perPotVolumeMl(flowRate, schedule.duration);
    const total = totalVolumeMl(flowRate, schedule.duration, numberOfPots);
    const rawStatus = scheduleStatusToday(
      schedule,
      Boolean(warning),
      history,
      nowIso,
      timeZone,
    );
    // "Ainda vai regar hoje" is a promise the zone cannot keep while the
    // master switch is off, so drop it. A warning still stands (it describes
    // a past failure) and so does "done" (it already ran today, possibly
    // before the switch was turned off).
    const status = masterOff && rawStatus === "pending" ? null : rawStatus;
    return html`
      <div class="schedule-row">
        <button
          class="toggle ${schedule.enabled ? "" : "off"}"
          type="button"
          role="switch"
          aria-checked=${schedule.enabled}
          title=${`Horário das ${formatTime(schedule.time)}: ${
            schedule.enabled ? "ativo" : "desativado"
          }`}
          aria-label=${`Horário das ${formatTime(schedule.time)}`}
          @click=${() => this._toggleScheduleEnabled(schedule)}
        >
          <span class="track"></span>
          <span class="thumb"></span>
        </button>
        <div class="schedule-info">
          <div class="schedule-info-top">
            <div class="schedule-time">${formatTime(schedule.time)}</div>
            <div class="schedule-days">
              ${dayInitials().map(
                (initial, day) => html`
                  <span class="day-initial ${schedule.days.includes(day) ? "active" : ""}">
                    ${initial}
                  </span>
                `,
              )}
            </div>
            ${status === "warning"
              ? html`
                  <ha-icon
                    class="warning-icon"
                    icon="mdi:alert"
                    title=${`Aviso: ${warning}`}
                  ></ha-icon>
                `
              : status === "done"
                ? html`
                    <ha-icon
                      class="status-icon status-done"
                      icon="mdi:check-circle"
                      title="Rega de hoje concluída"
                    ></ha-icon>
                  `
                : status === "pending"
                  ? html`
                      <ha-icon
                        class="status-icon status-pending"
                        icon="mdi:clock-outline"
                        title="Ainda vai regar hoje"
                      ></ha-icon>
                    `
                  : ""}
          </div>
          <div class="schedule-duration">
            ${formatDuration(schedule.duration)}
            ${total !== null
              ? html`<span class="schedule-volume">· ≈ ${formatMl(total)}</span>`
              : ""}
            ${total !== null && perPot !== null
              ? html`<span class="schedule-perpot">· ${formatMl(perPot)}/vaso</span>`
              : ""}
          </div>
        </div>
        <div class="schedule-actions">
          <button class="row-action" type="button" title="Editar" aria-label="Editar horário" @click=${() => this._openEdit(schedule)}>
            <ha-icon icon="mdi:pencil"></ha-icon>
          </button>
          <button class="row-action delete" type="button" title="Excluir" aria-label="Excluir horário" @click=${() => this._deleteSchedule(schedule)}>
            <ha-icon icon="mdi:trash-can-outline"></ha-icon>
          </button>
        </div>
      </div>
    `;
  }

  private _renderSettings(
    zoneName: string,
    defaultDurationSec: number,
    flowRate: number,
    numberOfPots: number,
    reservoirVolume: number,
    phEntityId: string,
    phMin: number,
    phMax: number,
    ecEntityId: string,
    phEntityId2: string,
    phMin2: number,
    phMax2: number,
    ecEntityId2: string,
  ): TemplateResult {
    if (!this._settingsOpen) {
      return html``;
    }
    const defaultDurationMin = Math.max(1, Math.round(defaultDurationSec / 60));
    return html`
      <div class="overlay" @click=${this._closeSettings}>
        <div
          class="dialog settings-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="irrigation-settings-title"
          tabindex="-1"
          @keydown=${this._onDialogKeydown}
          @click=${(ev: Event) => ev.stopPropagation()}
        >
          <div class="dialog-header">
            <div>
              <small>Configurações</small>
              <h3 id="irrigation-settings-title">${zoneName}</h3>
            </div>
            <button
              class="icon-button"
              type="button"
              title="Fechar"
              aria-label="Fechar"
              @click=${this._closeSettings}
            >
              <ha-icon icon="mdi:close"></ha-icon>
            </button>
          </div>
          <div class="dialog-body">
            <div class="field-grid">
              <div class="field">
                <label>Duração padrão da rega (min)</label>
                <input
                  type="number"
                  min="1"
                  .value=${this._settingsDefaultDuration || String(defaultDurationMin)}
                  @change=${this._onSettingsDefaultDurationChange}
                />
              </div>
              <div class="field">
                <label>Vazão por vaso (L/h)</label>
                <input
                  type="number"
                  min="0"
                  .value=${this._settingsFlow || String(flowRate)}
                  @change=${this._onSettingsFlowChange}
                />
              </div>
              <div class="field">
                <label>Número de vasos</label>
                <input
                  type="number"
                  min="0"
                  .value=${this._settingsPots || String(numberOfPots)}
                  @change=${this._onSettingsPotsChange}
                />
              </div>
              <div class="field">
                <label>Volume do reservatório (L)</label>
                <input
                  type="number"
                  min="0"
                  .value=${this._settingsReservoir || String(reservoirVolume)}
                  @change=${this._onSettingsReservoirChange}
                />
              </div>
            </div>

            <div class="dialog-divider"></div>
            <h4 class="section-title">Reservatório 1</h4>
            <div class="field">
              <label>Sensor de pH (opcional)</label>
              <input
                type="text"
                list="ph-sensor-options"
                placeholder="sensor.reservatorio_ph"
                .value=${this._settingsPhEntityTouched ? this._settingsPhEntity : phEntityId}
                @change=${this._onSettingsPhEntityChange}
              />
              <datalist id="ph-sensor-options">
                ${this._sensorEntityIds().map((id) => html`<option value=${id}></option>`)}
              </datalist>
            </div>
            <div class="field">
              <label>Faixa de pH pra regar (agendado)</label>
              <div class="duration-row">
                <div class="duration-part">
                  <input
                    type="number"
                    min="0"
                    max="14"
                    step="0.1"
                    .value=${this._settingsPhMin || String(phMin)}
                    @change=${this._onSettingsPhMinChange}
                  />
                </div>
                <div class="duration-part">
                  <input
                    type="number"
                    min="0"
                    max="14"
                    step="0.1"
                    .value=${this._settingsPhMax || String(phMax)}
                    @change=${this._onSettingsPhMaxChange}
                  />
                </div>
              </div>
            </div>
            <div class="field">
              <label>Sensor de EC (opcional, só exibição)</label>
              <input
                type="text"
                list="ec-sensor-options"
                placeholder="sensor.reservatorio_ec"
                .value=${this._settingsEcEntityTouched ? this._settingsEcEntity : ecEntityId}
                @change=${this._onSettingsEcEntityChange}
              />
              <datalist id="ec-sensor-options">
                ${this._sensorEntityIds().map((id) => html`<option value=${id}></option>`)}
              </datalist>
            </div>

            <div class="dialog-divider"></div>
            <h4 class="section-title">Reservatório 2 (opcional)</h4>
            <div class="field">
              <label>Sensor de pH (opcional)</label>
              <input
                type="text"
                list="ph-sensor-options-2"
                placeholder="sensor.reservatorio2_ph"
                .value=${this._settingsPhEntity2Touched ? this._settingsPhEntity2 : phEntityId2}
                @change=${this._onSettingsPhEntity2Change}
              />
              <datalist id="ph-sensor-options-2">
                ${this._sensorEntityIds().map((id) => html`<option value=${id}></option>`)}
              </datalist>
            </div>
            <div class="field">
              <label>Faixa de pH pra regar (agendado)</label>
              <div class="duration-row">
                <div class="duration-part">
                  <input
                    type="number"
                    min="0"
                    max="14"
                    step="0.1"
                    .value=${this._settingsPhMin2 || String(phMin2)}
                    @change=${this._onSettingsPhMin2Change}
                  />
                </div>
                <div class="duration-part">
                  <input
                    type="number"
                    min="0"
                    max="14"
                    step="0.1"
                    .value=${this._settingsPhMax2 || String(phMax2)}
                    @change=${this._onSettingsPhMax2Change}
                  />
                </div>
              </div>
            </div>
            <div class="field">
              <label>Sensor de EC (opcional, só exibição)</label>
              <input
                type="text"
                list="ec-sensor-options-2"
                placeholder="sensor.reservatorio2_ec"
                .value=${this._settingsEcEntity2Touched ? this._settingsEcEntity2 : ecEntityId2}
                @change=${this._onSettingsEcEntity2Change}
              />
              <datalist id="ec-sensor-options-2">
                ${this._sensorEntityIds().map((id) => html`<option value=${id}></option>`)}
              </datalist>
            </div>

            ${this._settingsError
              ? html`<div class="form-error">${this._settingsError}</div>`
              : ""}
          </div>
          <div class="dialog-actions">
            <button type="button" class="dialog-cancel" @click=${this._closeSettings}>
              Fechar
            </button>
            <button type="button" class="dialog-save" @click=${this._saveSettings}>Salvar</button>
          </div>
        </div>
      </div>
    `;
  }

  private _openSettings(): void {
    // Closing via the cog (not just the "Fechar" button) must reset the
    // form the same way _closeSettings does -- otherwise reopening later
    // shows stale typed values, and any *Touched flag left set could
    // resend a field the user had actually abandoned.
    if (this._settingsOpen) {
      this._closeSettings();
    } else {
      this._rememberDialogFocus();
      this._settingsOpen = true;
      this._focusOpenDialog();
    }
  }

  private _openHistory(): void {
    this._rememberDialogFocus();
    this._historyOpen = true;
    this._focusOpenDialog();
  }

  private _closeHistory(): void {
    this._historyOpen = false;
    this._restoreDialogFocus();
  }

  private _closeSettings(): void {
    this._settingsOpen = false;
    this._settingsDefaultDuration = "";
    this._settingsFlow = "";
    this._settingsPots = "";
    this._settingsReservoir = "";
    this._settingsPhEntity = "";
    this._settingsPhEntityTouched = false;
    this._settingsPhMin = "";
    this._settingsPhMax = "";
    this._settingsEcEntity = "";
    this._settingsEcEntityTouched = false;
    this._settingsPhEntity2 = "";
    this._settingsPhEntity2Touched = false;
    this._settingsPhMin2 = "";
    this._settingsPhMax2 = "";
    this._settingsEcEntity2 = "";
    this._settingsEcEntity2Touched = false;
    this._settingsError = null;
    this._restoreDialogFocus();
  }

  private _onSettingsDefaultDurationChange(ev: Event): void {
    this._settingsDefaultDuration = (ev.target as HTMLInputElement).value;
  }

  private _onSettingsFlowChange(ev: Event): void {
    this._settingsFlow = (ev.target as HTMLInputElement).value;
  }

  private _onSettingsPotsChange(ev: Event): void {
    this._settingsPots = (ev.target as HTMLInputElement).value;
  }

  private _onSettingsReservoirChange(ev: Event): void {
    this._settingsReservoir = (ev.target as HTMLInputElement).value;
  }

  private _onSettingsPhEntityChange(ev: Event): void {
    this._settingsPhEntity = (ev.target as HTMLInputElement).value.trim();
    this._settingsPhEntityTouched = true;
    this._settingsError = null;
  }

  private _onSettingsPhMinChange(ev: Event): void {
    this._settingsPhMin = (ev.target as HTMLInputElement).value;
    this._settingsError = null;
  }

  private _onSettingsPhMaxChange(ev: Event): void {
    this._settingsPhMax = (ev.target as HTMLInputElement).value;
    this._settingsError = null;
  }

  private _onSettingsEcEntityChange(ev: Event): void {
    this._settingsEcEntity = (ev.target as HTMLInputElement).value.trim();
    this._settingsEcEntityTouched = true;
    this._settingsError = null;
  }

  private _onSettingsPhEntity2Change(ev: Event): void {
    this._settingsPhEntity2 = (ev.target as HTMLInputElement).value.trim();
    this._settingsPhEntity2Touched = true;
    this._settingsError = null;
  }

  private _onSettingsPhMin2Change(ev: Event): void {
    this._settingsPhMin2 = (ev.target as HTMLInputElement).value;
    this._settingsError = null;
  }

  private _onSettingsPhMax2Change(ev: Event): void {
    this._settingsPhMax2 = (ev.target as HTMLInputElement).value;
    this._settingsError = null;
  }

  private _onSettingsEcEntity2Change(ev: Event): void {
    this._settingsEcEntity2 = (ev.target as HTMLInputElement).value.trim();
    this._settingsEcEntity2Touched = true;
    this._settingsError = null;
  }

  private _saveSettings(): void {
    const defaultDurationMin = Number.parseInt(this._settingsDefaultDuration, 10);
    const flow = Number.parseInt(this._settingsFlow, 10);
    const pots = Number.parseInt(this._settingsPots, 10);
    const reservoir = Number.parseInt(this._settingsReservoir, 10);
    const data: Record<string, unknown> = {};
    if (Number.isFinite(defaultDurationMin) && defaultDurationMin >= 1) {
      data.default_duration = defaultDurationMin * 60;
    }
    if (Number.isFinite(flow) && flow >= 0) {
      data.flow_rate_lph = flow;
    }
    if (Number.isFinite(pots) && pots >= 0) {
      data.number_of_pots = pots;
    }
    if (Number.isFinite(reservoir) && reservoir >= 0) {
      data.reservoir_volume_l = reservoir;
    }

    // ph_min/ph_max follow the same "blank = unchanged" convention as the
    // other numeric fields above; only a cross-field contradiction (both
    // valid but min > max) is worth surfacing as an error.
    const phMin = Number.parseFloat(this._settingsPhMin);
    const phMax = Number.parseFloat(this._settingsPhMax);
    const validMin = Number.isFinite(phMin) && phMin >= 0 && phMin <= 14;
    const validMax = Number.isFinite(phMax) && phMax >= 0 && phMax <= 14;
    const sensor = this._sensorEntity;
    const effectiveMin = validMin ? phMin : (this._numberAttr(sensor, "ph_min") ?? 0);
    const effectiveMax = validMax ? phMax : (this._numberAttr(sensor, "ph_max") ?? 14);
    if ((validMin || validMax) && effectiveMin > effectiveMax) {
      this._settingsError = "O pH mínimo não pode ser maior que o pH máximo.";
      return;
    }
    if (validMin) {
      data.ph_min = phMin;
    }
    if (validMax) {
      data.ph_max = phMax;
    }
    if (this._settingsPhEntityTouched) {
      // Only send ph_entity_id when the field was actually edited: an empty
      // string here is the explicit "disable the gate" value, so it must
      // never be sent just because the field was left at its default blank
      // display state.
      data.ph_entity_id = this._settingsPhEntity;
    }
    if (this._settingsEcEntityTouched) {
      data.ec_entity_id = this._settingsEcEntity;
    }

    // Second, independent reservoir -- same "blank = unchanged" convention.
    const phMin2 = Number.parseFloat(this._settingsPhMin2);
    const phMax2 = Number.parseFloat(this._settingsPhMax2);
    const validMin2 = Number.isFinite(phMin2) && phMin2 >= 0 && phMin2 <= 14;
    const validMax2 = Number.isFinite(phMax2) && phMax2 >= 0 && phMax2 <= 14;
    const effectiveMin2 = validMin2
      ? phMin2
      : (this._numberAttr(sensor, "ph_min_2") ?? 0);
    const effectiveMax2 = validMax2
      ? phMax2
      : (this._numberAttr(sensor, "ph_max_2") ?? 14);
    if ((validMin2 || validMax2) && effectiveMin2 > effectiveMax2) {
      this._settingsError = "O pH mínimo R2 não pode ser maior que o pH máximo R2.";
      return;
    }
    if (validMin2) {
      data.ph_min_2 = phMin2;
    }
    if (validMax2) {
      data.ph_max_2 = phMax2;
    }
    if (this._settingsPhEntity2Touched) {
      data.ph_entity_id_2 = this._settingsPhEntity2;
    }
    if (this._settingsEcEntity2Touched) {
      data.ec_entity_id_2 = this._settingsEcEntity2;
    }

    if (Object.keys(data).length === 0) {
      this._closeSettings();
      return;
    }
    // Keep the panel open on failure (e.g. a backend ServiceValidationError)
    // instead of silently closing as if the settings had been saved: the
    // user must see why nothing changed.
    void this._callService("set_zone_options", data).then(
      () => this._closeSettings(),
      (error: unknown) => {
        this._settingsError = this._describeServiceError(error);
      },
    );
  }

  // ------------------------------------------------------------------
  // History
  // ------------------------------------------------------------------

  private _lastRunText(lastRun: HistoryRun, nowIso: string): string {
    const timeZone = this.hass?.config?.time_zone;
    const date = new Date(lastRun.started_at);
    const dayLabel = dayLabelFor(lastRun.started_at, nowIso, timeZone);
    const time = Number.isNaN(date.getTime())
      ? ""
      : new Intl.DateTimeFormat("pt-BR", {
          timeZone,
          hour: "2-digit",
          minute: "2-digit",
        }).format(date);
    const perPot = perPotVolumeMl(lastRun.flow_rate_lph, lastRun.duration);
    const parts = [
      [dayLabel, time].filter(Boolean).join(" "),
      sourceLabel(lastRun.source),
      formatDuration(lastRun.duration),
    ];
    if (perPot !== null) {
      parts.push(`${formatMl(perPot)}/vaso`);
    }
    return parts.filter(Boolean).join(" · ");
  }

  private _renderHistoryDialog(
    history: HistoryRun[],
    zoneName: string,
    nowIso: string,
  ): TemplateResult {
    if (!this._historyOpen) {
      return html``;
    }
    const groups = groupHistoryByDay(history, nowIso, this.hass?.config?.time_zone);
    const totalMl = groups.reduce((sum, group) => sum + group.totalMl, 0);
    return html`
      <div class="overlay" @click=${this._closeHistory}>
        <div
          class="dialog history-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="irrigation-history-title"
          tabindex="-1"
          @keydown=${this._onDialogKeydown}
          @click=${(ev: Event) => ev.stopPropagation()}
        >
          <div class="dialog-header" id="irrigation-history-title">
            Histórico de regas
            <div class="history-subtitle">${zoneName} · últimos 30 dias</div>
          </div>
          <div class="history-stats">
            <div class="history-stat">
              <span class="history-stat-value">${history.length}</span>
              <span class="history-stat-label">${history.length === 1 ? "rega" : "regas"}</span>
            </div>
            <div class="history-stat">
              <span class="history-stat-value">${formatMl(totalMl)}</span>
              <span class="history-stat-label">total no período</span>
            </div>
          </div>
          <div class="history-body">
            ${groups.length === 0
              ? html`<div class="empty">Nenhuma rega registrada ainda.</div>`
              : groups.map((group) => this._renderHistoryDayGroup(group))}
          </div>
          <div class="dialog-actions">
            <button type="button" class="dialog-cancel" @click=${this._closeHistory}>Fechar</button>
          </div>
        </div>
      </div>
    `;
  }

  private _renderHistoryDayGroup(group: HistoryDayGroup): TemplateResult {
    return html`
      <div class="history-day">
        <div class="history-day-header">
          <span>${group.label}</span>
          <span class="history-day-total">
            ${group.entries.length} ${group.entries.length === 1 ? "rega" : "regas"}
            ${group.totalMl > 0 ? html`· ${formatMl(group.totalMl)}` : ""}
            ${group.perPotMl > 0
              ? html` · ${formatMl(group.perPotMl)}/vaso`
              : ""}
          </span>
        </div>
        ${group.entries.map((entry) => this._renderHistoryEntry(entry))}
      </div>
    `;
  }

  private _renderHistoryEntry(entry: HistoryRun): TemplateResult {
    const date = new Date(entry.started_at);
    const time = Number.isNaN(date.getTime())
      ? ""
      : new Intl.DateTimeFormat("pt-BR", {
          timeZone: this.hass?.config?.time_zone,
          hour: "2-digit",
          minute: "2-digit",
        }).format(date);
    const perPot = perPotVolumeMl(entry.flow_rate_lph, entry.duration);
    return html`
      <div class="history-entry">
        <ha-icon icon=${sourceIcon(entry.source)}></ha-icon>
        <span>${time} · ${sourceLabel(entry.source)}</span>
        <span class="schedule-row-spacer"></span>
        <span class="history-entry-detail">
          ${formatDuration(entry.duration)}
          ${perPot !== null ? html` · ${formatMl(perPot)}/vaso` : ""}
          ${typeof entry.ph_value === "number"
            ? html` · ${formatSensorReading(entry.ph_value)} PH`
            : ""}
          ${typeof entry.ec_value === "number"
            ? html` · EC ${formatSensorReading(entry.ec_value, entry.ec_unit ?? undefined)}`
            : ""}
          ${typeof entry.ph_value_2 === "number"
            ? html` · ${formatSensorReading(entry.ph_value_2)} PH R2`
            : ""}
          ${typeof entry.ec_value_2 === "number"
            ? html` · EC ${formatSensorReading(entry.ec_value_2, entry.ec_unit_2 ?? undefined)} R2`
            : ""}
        </span>
      </div>
    `;
  }

  private _renderDialog(labels: string[], flowRate: number): TemplateResult {
    if (!this._dialogOpen) {
      return html``;
    }
    const totalDurationSec =
      this._formDurationHour * 3600 + this._formDurationMin * 60 + this._formDurationSec;
    const volumeMl = perPotVolumeMl(flowRate, totalDurationSec);
    return html`
      <div class="overlay" @click=${this._closeDialog}>
        <div
          class="dialog schedule-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="irrigation-schedule-dialog-title"
          tabindex="-1"
          @keydown=${this._onDialogKeydown}
          @click=${(ev: Event) => ev.stopPropagation()}
        >
          <div class="dialog-header">
            <div>
              <small>Agenda automática</small>
              <h3 id="irrigation-schedule-dialog-title">
                ${this._editingId ? "Editar horário" : "Adicionar horário"}
              </h3>
            </div>
            <button
              class="icon-button"
              type="button"
              title="Fechar"
              aria-label="Fechar"
              @click=${this._closeDialog}
            >
              <ha-icon icon="mdi:close"></ha-icon>
            </button>
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
              <label>Duração</label>
              <div class="duration-box">
                <div class="duration-segment">
                  <span class="duration-segment-label">hh</span>
                  <input
                    class="duration-segment-input"
                    type="number"
                    min="0"
                    max="99"
                    .value=${String(this._formDurationHour).padStart(2, "0")}
                    @change=${this._onDurationHourChange}
                  />
                </div>
                <span class="duration-colon">:</span>
                <div class="duration-segment">
                  <span class="duration-segment-label">mm</span>
                  <input
                    class="duration-segment-input"
                    type="number"
                    min="0"
                    max="59"
                    .value=${String(this._formDurationMin).padStart(2, "0")}
                    @change=${this._onDurationMinChange}
                  />
                </div>
                <span class="duration-colon">:</span>
                <div class="duration-segment">
                  <span class="duration-segment-label">ss</span>
                  <input
                    class="duration-segment-input"
                    type="number"
                    min="0"
                    max="59"
                    .value=${String(this._formDurationSec).padStart(2, "0")}
                    @change=${this._onDurationSecChange}
                  />
                </div>
              </div>
            </div>
            <div class="duration-preview">
              <ha-icon icon="mdi:timer-outline"></ha-icon>
              <span>Regará por <strong>${formatDuration(totalDurationSec)}</strong></span>
            </div>
            ${volumeMl !== null
              ? html`
                  <div class="field">
                    <label>Volume por vaso (ml)</label>
                    <input
                      type="number"
                      min="0"
                      .value=${String(Math.round(volumeMl))}
                      @change=${this._onVolumeChange}
                    />
                  </div>
                `
              : ""}
            <fieldset class="day-fieldset">
              <legend>Dias da semana</legend>
              <div class="day-grid">
                ${labels.map(
                  (label, day) => html`
                    <label>
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
            </fieldset>
            ${this._formError
              ? html`<div class="form-error">${this._formError}</div>`
              : ""}
          </div>
          <div class="dialog-actions">
            ${this._editingId
              ? html`
                  <button
                    class="delete-button"
                    type="button"
                    @click=${this._deleteEditingSchedule}
                  >
                    <ha-icon icon="mdi:trash-can-outline"></ha-icon>
                    Excluir
                  </button>
                `
              : ""}
            <span class="dialog-actions-spacer"></span>
            <button type="button" class="dialog-cancel" @click=${this._closeDialog}>
              Cancelar
            </button>
            <button type="button" class="dialog-save" @click=${this._saveDialog}>Salvar</button>
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

  private _scheduleWarnings(entity: HassEntity | undefined): Record<string, string> {
    const value = entity?.attributes.schedule_warnings;
    if (!value || typeof value !== "object") {
      return {};
    }
    const result: Record<string, string> = {};
    for (const [id, reason] of Object.entries(value as Record<string, unknown>)) {
      if (typeof reason === "string") {
        result[id] = reason;
      }
    }
    return result;
  }

  private _isHistoryRun(value: unknown): value is HistoryRun {
    if (!value || typeof value !== "object") {
      return false;
    }
    const v = value as Record<string, unknown>;
    return (
      typeof v.started_at === "string" &&
      !Number.isNaN(Date.parse(v.started_at)) &&
      typeof v.duration === "number" &&
      Number.isFinite(v.duration)
    );
  }

  private _lastRunAttr(entity: HassEntity | undefined): HistoryRun | null {
    const value = entity?.attributes.last_run;
    return this._isHistoryRun(value) ? value : null;
  }

  private _historyAttr(entity: HassEntity | undefined): HistoryRun[] {
    const value = entity?.attributes.history;
    if (!Array.isArray(value)) {
      return [];
    }
    return value.filter((item): item is HistoryRun => this._isHistoryRun(item));
  }

  private _sensorEntityIds(): string[] {
    if (!this.hass) {
      return [];
    }
    return Object.keys(this.hass.states)
      .filter((id) => id.startsWith("sensor."))
      .sort();
  }

  /**
   * CSS modifier for the pH badge's color: "in-range" (green) / "out-of-range"
   * (red) when the current reading can be compared against ph_min/ph_max, or
   * "" (neutral) when the gate is disabled or the reading is unknown/invalid
   * -- color should never claim a status we can't actually verify.
   */
  private _phStatusClass(entityId: string, phMin: number, phMax: number): string {
    if (!entityId) {
      return "";
    }
    const state = this.hass?.states[entityId];
    const value = state ? Number.parseFloat(state.state) : Number.NaN;
    if (!Number.isFinite(value)) {
      return "";
    }
    return value >= phMin && value <= phMax ? "in-range" : "out-of-range";
  }

  /**
   * Formats a header badge ("5.4 PH" / "EC 812.5 µS/cm"); ``missing`` while
   * the configured entity is absent/unavailable/unparseable. ``render``
   * receives the entity's OWN ``unit_of_measurement`` (may be undefined) so
   * each badge decides for itself whether to use it -- the pH badge ignores
   * it in favor of a fixed "PH" suffix, since some pH sensors set their own
   * unit to "pH" too, which would otherwise duplicate ("PH 5.4pH").
   */
  private _sensorBadgeText(
    entityId: string,
    missing: string,
    render: (value: number, unit?: string) => string,
  ): string {
    const state = this.hass?.states[entityId];
    const value = state ? Number.parseFloat(state.state) : Number.NaN;
    if (!Number.isFinite(value)) {
      return missing;
    }
    const unit =
      typeof state?.attributes.unit_of_measurement === "string"
        ? state.attributes.unit_of_measurement
        : undefined;
    return render(value, unit);
  }

  /**
   * Open Home Assistant's own more-info dialog for `entityId` (its History
   * tab already renders a daily graph) instead of building a custom chart:
   * `hass-more-info` is the standard event any Lovelace card fires to ask
   * the dashboard shell to open it, and it already knows how to chart any
   * numeric sensor's history.
   */
  private _openMoreInfo(entityId: string): void {
    this.dispatchEvent(
      new CustomEvent("hass-more-info", {
        detail: { entityId },
        bubbles: true,
        composed: true,
      }),
    );
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

  private _nextRunText(state: string): string {
    const date = new Date(state);
    if (!state || Number.isNaN(date.getTime())) {
      return "Nenhum horário agendado";
    }
    // Fixed pt-BR: every other string in this card is hardcoded Portuguese
    // too (see dayLabels() for why this no longer follows hass.locale).
    // timeZone: the HA SERVER's zone, not the viewing browser's -- without
    // it, an admin checking the dashboard from a different timezone than
    // the HA instance would see a "next run" time that looks wrong relative
    // to when the zone will actually fire.
    return new Intl.DateTimeFormat("pt-BR", {
      timeZone: this.hass?.config?.time_zone,
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

  /** Start the one-second countdown, if a run is active and it is not running. */
  private _startTicker(): void {
    if (this._tickerId !== null || !this._isWatering()) {
      return;
    }
    // Seeded immediately so a reattached card shows the CURRENT remaining
    // time instead of the "no tick yet" fallback for up to a second.
    this._now = Date.now();
    this._tickerId = window.setInterval(() => {
      this._now = Date.now();
    }, 1000);
  }

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

  private _callService(
    service: string,
    data: Record<string, unknown> = {},
  ): Promise<void> {
    if (!this.hass || !this._config.entity) {
      return Promise.resolve();
    }
    const entityId = this._config.entity;
    return this.hass
      .callService(DOMAIN, service, data, { entity_id: entityId })
      .catch((error: unknown) => {
        console.error(`[irrigation-schedule-card] ${DOMAIN}.${service} failed`, error);
        throw error;
      });
  }

  /**
   * Run a service call that has no dialog of its own to report into.
   *
   * `_callService` logs and RE-THROWS so the schedule/settings dialogs can
   * render the backend's message inline; the direct actions (regar, parar,
   * refil, toggle, excluir) have nowhere to render it, and leaving the
   * rejection unhandled produced an "Uncaught (in promise)" with zero
   * feedback for the user. Surfaced as Home Assistant's own toast instead --
   * `hass-notification` is the standard event a Lovelace card fires to ask
   * the dashboard shell to show one, the same way `hass-more-info` asks it to
   * open a dialog.
   */
  private _callServiceNotifying(
    service: string,
    data: Record<string, unknown> = {},
  ): void {
    void this._callService(service, data).catch((error: unknown) => {
      this.dispatchEvent(
        new CustomEvent("hass-notification", {
          detail: { message: this._describeServiceError(error) },
          bubbles: true,
          composed: true,
        }),
      );
    });
  }

  /** Best-effort human-readable message from a failed hass.callService(). */
  private _describeServiceError(error: unknown): string {
    if (error && typeof error === "object" && "message" in error) {
      const message = (error as { message?: unknown }).message;
      if (typeof message === "string" && message.trim()) {
        return message;
      }
    }
    return "Não foi possível salvar: o backend rejeitou os dados enviados.";
  }

  private _waterNow(): void {
    this._callServiceNotifying("water_now");
  }

  private _toggleMaster(entity: HassEntity, currentlyOn: boolean): void {
    if (!this.hass) {
      return;
    }
    void this.hass
      .callService(
        "switch",
        currentlyOn ? "turn_off" : "turn_on",
        {},
        { entity_id: entity.entity_id },
      )
      .catch((error: unknown) => {
        console.error(
          "[irrigation-schedule-card] switch toggle failed",
          error,
        );
      });
  }

  private _stopWatering(): void {
    this._callServiceNotifying("stop");
  }

  private _refillReservoir(): void {
    if (window.confirm("Marcar o reservatório como reabastecido (volume cheio)?")) {
      this._callServiceNotifying("refill_reservoir");
    }
  }

  private _toggleScheduleEnabled(schedule: Schedule): void {
    this._callServiceNotifying("update_schedule", {
      id: schedule.id,
      enabled: !schedule.enabled,
    });
  }

  private _deleteSchedule(schedule: Schedule): void {
    if (window.confirm(`Excluir o horário das ${formatTime(schedule.time)}?`)) {
      this._callServiceNotifying("remove_schedule", { id: schedule.id });
    }
  }

  private _deleteEditingSchedule(): void {
    if (!this._editingId) {
      return;
    }
    if (window.confirm(`Excluir o horário das ${this._formTime}?`)) {
      void this._callService("remove_schedule", { id: this._editingId }).then(
        () => this._closeDialog(),
        (error: unknown) => {
          // The dialog stays open on failure, like _saveDialog: the user
          // must see why the schedule is still there.
          this._formError = this._describeServiceError(error);
        },
      );
    }
  }

  // ------------------------------------------------------------------
  // Dialog
  // ------------------------------------------------------------------

  private _openAdd(): void {
    this._rememberDialogFocus();
    this._editingId = null;
    this._formTime = "00:00";
    this._formDays = [];
    this._formDurationHour = 0;
    this._formDurationMin = 0;
    this._formDurationSec = 0;
    this._formError = null;
    this._dialogOpen = true;
    this._focusOpenDialog();
  }

  private _openEdit(schedule: Schedule): void {
    this._rememberDialogFocus();
    this._editingId = schedule.id;
    this._formTime = formatTime(schedule.time);
    this._formDays = [...schedule.days];
    const total = Math.max(1, Math.round(schedule.duration));
    this._formDurationHour = Math.floor(total / 3600);
    this._formDurationMin = Math.floor((total % 3600) / 60);
    this._formDurationSec = total % 60;
    this._formError = null;
    this._dialogOpen = true;
    this._focusOpenDialog();
  }

  private _closeDialog(): void {
    this._dialogOpen = false;
    this._editingId = null;
    this._formError = null;
    this._restoreDialogFocus();
  }

  private _rememberDialogFocus(): void {
    this._focusBeforeDialog =
      (this.shadowRoot?.activeElement as HTMLElement | null) ??
      (document.activeElement as HTMLElement | null);
  }

  private _focusOpenDialog(): void {
    void this.updateComplete.then(() => {
      this.shadowRoot?.querySelector<HTMLElement>('.dialog[role="dialog"]')?.focus();
    });
  }

  private _restoreDialogFocus(): void {
    const previous = this._focusBeforeDialog;
    this._focusBeforeDialog = null;
    void this.updateComplete.then(() => previous?.focus());
  }

  private _onDialogKeydown(ev: KeyboardEvent): void {
    if (ev.key === "Escape") {
      ev.preventDefault();
      if (this._settingsOpen) {
        this._closeSettings();
      } else if (this._historyOpen) {
        this._closeHistory();
      } else {
        this._closeDialog();
      }
      return;
    }
    if (ev.key !== "Tab") {
      return;
    }
    const dialog = ev.currentTarget as HTMLElement;
    const focusable = Array.from(
      dialog.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    );
    if (focusable.length === 0) {
      ev.preventDefault();
      dialog.focus();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (ev.shiftKey && this.shadowRoot?.activeElement === first) {
      ev.preventDefault();
      last.focus();
    } else if (!ev.shiftKey && this.shadowRoot?.activeElement === last) {
      ev.preventDefault();
      first.focus();
    }
  }

  private _saveDialog(): void {
    const time = toServiceTime(this._formTime);
    const days = [...this._formDays].sort((a, b) => a - b);
    const duration =
      this._formDurationHour * 3600 + this._formDurationMin * 60 + this._formDurationSec;
    if (timeToSeconds(time) < 0 || days.length === 0 || duration <= 0) {
      this._formError = "Informe um horário, ao menos um dia e uma duração válida.";
      return;
    }
    const call = this._editingId
      ? this._callService("update_schedule", {
          id: this._editingId,
          time,
          days,
          duration,
        })
      : this._callService("add_schedule", { time, days, duration, enabled: true });
    // Keep the dialog open on failure (e.g. a backend ServiceValidationError)
    // instead of silently closing as if the schedule had been saved: the
    // user must see why nothing changed.
    void call.then(
      () => this._closeDialog(),
      (error: unknown) => {
        this._formError = this._describeServiceError(error);
      },
    );
  }

  private _onTimeChanged(ev: Event): void {
    const value = (ev.target as HTMLInputElement).value;
    if (typeof value === "string") {
      this._formTime = value;
      this._formError = null;
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
    this._formError = null;
  }

  private _onDurationHourChange(ev: Event): void {
    const raw = (ev.target as HTMLInputElement).value;
    const parsed = Number.parseInt(raw, 10);
    this._formDurationHour =
      Number.isFinite(parsed) && parsed >= 0 ? Math.min(99, parsed) : 0;
    this._formError = null;
  }

  private _onDurationMinChange(ev: Event): void {
    const raw = (ev.target as HTMLInputElement).value;
    const parsed = Number.parseInt(raw, 10);
    this._formDurationMin =
      Number.isFinite(parsed) && parsed >= 0 ? Math.min(59, parsed) : 0;
    this._formError = null;
  }

  private _onDurationSecChange(ev: Event): void {
    const raw = (ev.target as HTMLInputElement).value;
    const parsed = Number.parseInt(raw, 10);
    const clamped =
      Number.isFinite(parsed) && parsed >= 0
        ? Math.min(59, parsed)
        : 0;
    this._formDurationSec = clamped;
    this._formError = null;
  }

  /** Editing the target volume recalculates hh:mm:ss from the zone's flow
   * rate (per pot) -- the inverse of the volume shown below the picker. */
  private _onVolumeChange(ev: Event): void {
    const raw = (ev.target as HTMLInputElement).value;
    const parsed = Number.parseInt(raw, 10);
    const flowRate = this._numberAttr(this._sensorEntity, "flow_rate_lph") ?? 0;
    const seconds = durationSecondsForPerPotVolumeMl(
      flowRate,
      Number.isFinite(parsed) ? parsed : 0,
    );
    if (seconds === null) {
      return;
    }
    this._formDurationHour = Math.floor(seconds / 3600);
    this._formDurationMin = Math.floor((seconds % 3600) / 60);
    this._formDurationSec = seconds % 60;
    this._formError = null;
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
