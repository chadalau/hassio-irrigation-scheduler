import { LitElement, html, svg, PropertyValues, TemplateResult } from "lit";
import { property, state } from "lit/decorators.js";

import {
  CARD_BUILD,
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
  PotSensorConfig,
  Schedule,
} from "./types";

type SettingsSection = "general" | "reservoir1" | "reservoir2" | "potSensors";
type PotHistoryHours = 6 | 12 | 24;

interface HistoryState {
  s?: string | number;
  state?: string | number;
}

interface StatisticState {
  mean?: number | null;
  state?: number | null;
}

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

  @state()
  private _settingsSection: SettingsSection = "general";

  @state()
  private _settingsPotSensors: PotSensorConfig[] = [];

  private _settingsPotSensorsTouched = false;

  @state()
  private _potSensorHistory = new Map<string, number[]>();

  @state()
  private _potHistoryHours: PotHistoryHours = 24;

  @state()
  private _potHistoryStatus:
    | "idle"
    | "loading"
    | "ready"
    | "empty"
    | "error"
    | "live" = "idle";

  private _potHistoryKey = "";
  private _potHistoryLoadedAt = 0;
  private _potHistoryRequestId = 0;

  /**
   * Samples collected from `hass.states` while the card is on screen, one per
   * entity, newest last.
   *
   * Last-resort source for the sparkline: the recorder is the good source, but
   * it can legitimately have nothing to give (sensor excluded from `recorder`,
   * database just purged, entity created minutes ago) and it can be
   * unreachable (no `callWS` on this `hass`, a Home Assistant build without
   * the history websocket command). In every one of those cases the tile used
   * to stay blank forever with no way for the card to recover on its own.
   * Feeding it live keeps the graph appearing — from the moment the dashboard
   * is opened rather than 24h back, which is stated in the tile's label so the
   * two are never confused.
   */
  private _potLiveSamples = new Map<string, number[]>();

  private _potLiveSampledAt = 0;

  private _draggedPotIndex: number | null = null;

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

  /**
   * Immediate visual state for schedule toggles while Home Assistant processes
   * the service call and publishes the updated sensor attributes.
   */
  private _scheduleEnabledOverrides = new Map<string, boolean>();

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
    if (changed.has("hass") || changed.has("_config")) {
      this._loadPotSensorHistory();
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
    const schedules = sortSchedulesByTime(
      sanitizeSchedules(sensor.attributes.schedules),
    ).map((schedule) => {
      const desired = this._scheduleEnabledOverrides.get(schedule.id);
      if (desired === undefined) {
        return schedule;
      }
      if (schedule.enabled === desired) {
        this._scheduleEnabledOverrides.delete(schedule.id);
        return schedule;
      }
      return { ...schedule, enabled: desired };
    });
    const defaultDurationSec = this._numberAttr(sensor, "default_duration") ?? 600;
    const flowRate = this._numberAttr(sensor, "flow_rate_lph") ?? 0;
    const numberOfPots = this._numberAttr(sensor, "number_of_pots") ?? 0;
    const potSensors = this._potSensorsAttr(sensor);
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
    // Volume and refill now live in the hero, so the body reservoir section
    // exists only when it has pH/EC telemetry to show.
    const showRow1 = Boolean(phEntityId || ecEntityId);
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
        ? `${Math.round(reservoirPct)}% do reservatório disponível${
            estimateText ? `; restam ${estimateText}` : ""
          }`
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
                    <div class="summary-value-row">
                      <strong>${summaryValue}</strong>
                      ${reservoirVolume > 0 ? refillButton : ""}
                    </div>
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
              </div>
            `
          : ""}

        ${this._renderPotSensors(potSensors)}

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
            <span class="schedule-status-slot">
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
            </span>
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

  private _renderPotSensors(sensors: PotSensorConfig[]): TemplateResult {
    if (sensors.length === 0) {
      return html``;
    }
    return html`
      <div class="section-divider"></div>
      <section class="card-body pot-sensors-section" aria-label="Sensores dos vasos">
        <div class="pot-sensors-heading">
          <h3 class="section-title">Sensores dos vasos</h3>
          <select
            class="pot-history-period"
            aria-label="Período do histórico dos sensores dos vasos"
            title="Período do gráfico"
            .value=${String(this._potHistoryHours)}
            @change=${this._changePotHistoryHours}
          >
            <option value="6">6 h</option>
            <option value="12">12 h</option>
            <option value="24">24 h</option>
          </select>
        </div>
        <div class="pot-sensors-grid">
          ${sensors.map((sensor) => this._renderPotSensor(sensor))}
        </div>
      </section>
    `;
  }

  private _renderPotSensor(config: PotSensorConfig): TemplateResult {
    const entity = this.hass?.states[config.entity_id];
    const value = entity ? Number.parseFloat(entity.state) : Number.NaN;
    const unit =
      typeof entity?.attributes.unit_of_measurement === "string"
        ? entity.attributes.unit_of_measurement
        : "%";
    const history = this._potSensorHistory.get(config.entity_id) ?? [];
    // The recorder is the good source; the live buffer only steps in when it
    // gave nothing, so a tile is never blank just because the history is
    // unavailable for this entity.
    const live = this._potLiveSamples.get(config.entity_id) ?? [];
    const usingLive = history.length === 0 && live.length > 1;
    const series = history.length > 0 ? history : usingLive ? live : [];
    const points =
      series.length > 0 && Number.isFinite(value) ? [...series, value] : series;
    const path = this._sparklinePath(points);
    const emptyLabel = usingLive
      ? "desde agora"
      : this._potHistoryStatus === "ready" && history.length === 0
        ? "Sem histórico"
        : {
            idle: "",
            loading: "Carregando…",
            ready: "",
            empty: "Sem histórico",
            error: "Histórico indisponível",
            live: "Coletando…",
          }[this._potHistoryStatus];
    return html`
      <button
        type="button"
        class="pot-sensor-tile"
        title=${`Abrir ${config.name}`}
        @click=${() => this._openMoreInfo(config.entity_id)}
      >
        <span class="pot-sensor-copy">
          <ha-icon icon="mdi:water-percent"></ha-icon>
          <small>${config.name}</small>
          <strong>${Number.isFinite(value) ? `${Math.round(value)}${unit}` : "—"}</strong>
        </span>
        <svg viewBox="0 0 100 28" preserveAspectRatio="none" aria-hidden="true">
          ${path
            ? // MUST be lit's `svg` tag, not `html`: a nested template is
              // parsed standalone, with no <svg> parent to inherit a
              // namespace from, so `html` produces <path> elements in the
              // HTML namespace. They land in the DOM with the right `d` and
              // the right computed stroke -- querySelector finds them, CSS
              // applies -- and the browser draws NOTHING, because an HTML
              // <path> is as inert as a <div>. That is exactly why the
              // sparkline was invisible while every check said it was fine;
              // the giveaway is `getBBox is not a function` on the element.
              svg`
                <path class="pot-sensor-area" d=${`${path} L100 28 L0 28 Z`}></path>
                <path class="pot-sensor-line" d=${path}></path>
              `
            : ""}
        </svg>
        ${emptyLabel
          ? html`<span class="pot-sensor-history-state">${emptyLabel}</span>`
          : ""}
      </button>
    `;
  }

  private _sparklinePath(values: number[]): string {
    const finite = values.filter(Number.isFinite).slice(-96);
    if (finite.length === 0) {
      return "";
    }
    if (finite.length === 1) {
      return "M0 14 L100 14";
    }
    const min = Math.min(...finite);
    const max = Math.max(...finite);
    const range = Math.max(1, max - min);
    return finite
      .map((value, index) => {
        const x = (index / (finite.length - 1)) * 100;
        const y = 25 - ((value - min) / range) * 22;
        return `${index === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
      })
      .join(" ");
  }

  private _potSensorsAttr(entity: HassEntity | undefined): PotSensorConfig[] {
    const value = entity?.attributes.pot_sensors;
    if (!Array.isArray(value)) {
      return [];
    }
    const seen = new Set<string>();
    return value.flatMap((item) => {
      if (!item || typeof item !== "object") {
        return [];
      }
      const record = item as Record<string, unknown>;
      if (
        typeof record.name !== "string" ||
        !record.name.trim() ||
        typeof record.entity_id !== "string" ||
        !record.entity_id.startsWith("sensor.") ||
        seen.has(record.entity_id)
      ) {
        return [];
      }
      seen.add(record.entity_id);
      return [{ name: record.name.trim(), entity_id: record.entity_id }];
    });
  }

  private _changePotHistoryHours(event: Event): void {
    const value = Number.parseInt((event.currentTarget as HTMLSelectElement).value, 10);
    if (value !== 6 && value !== 12 && value !== 24) {
      return;
    }
    if (value === this._potHistoryHours) {
      return;
    }
    this._potHistoryHours = value;
    this._potHistoryLoadedAt = 0;
    this._potHistoryKey = "";
    this._potSensorHistory = new Map();
    this._potHistoryStatus = "idle";
    this._potHistoryRequestId += 1;
    this._loadPotSensorHistory();
  }

  /**
   * Send a websocket command, whichever way this `hass` allows.
   *
   * `callWS` is the normal path, but it is optional on the object Lovelace
   * hands a card, and when it was missing the whole history load returned
   * early and left every tile blank with NO message at all (the idle label is
   * empty by design). Falling back to the underlying connection removes that
   * silent dead end; when neither exists the caller reports it instead of
   * going quiet.
   */
  private _callWS<T>(message: Record<string, unknown>): Promise<T> | null {
    let request: Promise<T> | null = null;
    if (this.hass?.callWS) {
      request = this.hass.callWS<T>(message);
    } else {
      const connection = this.hass?.connection;
      const send = connection?.sendMessagePromise;
      if (connection && send) {
        request = send.call(connection, message) as Promise<T>;
      }
    }
    if (!request) {
      return null;
    }
    // A websocket command that never settles would leave the tiles stuck on
    // "Carregando…" forever, which looks exactly like the silent blank this
    // whole area is meant to stop producing. Losing the race is reported as a
    // rejection, so it lands in the same log and label as any other failure.
    return Promise.race([
      request,
      new Promise<T>((_resolve, reject) =>
        setTimeout(
          () => reject(new Error(`timeout em ${String(message.type)}`)),
          15_000,
        ),
      ),
    ]);
  }

  /** Append the current reading of each pot sensor to the live buffer. */
  private _collectPotLiveSamples(sensors: readonly PotSensorConfig[]): void {
    const now = Date.now();
    // One sample a minute is plenty for a 100px sparkline and keeps the
    // buffer meaningful over a long-lived dashboard session.
    if (now - this._potLiveSampledAt < 60_000) {
      return;
    }
    this._potLiveSampledAt = now;
    let collected = false;
    for (const sensor of sensors) {
      const value = Number.parseFloat(
        this.hass?.states[sensor.entity_id]?.state ?? "",
      );
      if (!Number.isFinite(value)) {
        continue;
      }
      const samples = this._potLiveSamples.get(sensor.entity_id) ?? [];
      samples.push(value);
      this._potLiveSamples.set(sensor.entity_id, samples.slice(-96));
      collected = true;
    }
    // The buffer is a plain Map read during render, and this runs FROM
    // `updated()` -- i.e. after the render that would have drawn it. Without
    // asking for another pass the new sample sits invisible until something
    // else happens to re-render, which is exactly how a live-only graph would
    // look permanently stuck. Throttled above, so this costs one extra render
    // a minute at most.
    if (collected) {
      this.requestUpdate();
    }
  }

  private _loadPotSensorHistory(): void {
    const sensors = this._potSensorsAttr(this._sensorEntity);
    const ids = sensors.map((sensor) => sensor.entity_id);
    this._collectPotLiveSamples(sensors);
    const key = `${this._potHistoryHours}:${ids.join("|")}`;
    if (key !== this._potHistoryKey) {
      this._potHistoryKey = key;
      this._potHistoryLoadedAt = 0;
      this._potSensorHistory = new Map();
      this._potHistoryStatus = "idle";
    }
    if (ids.length === 0 || Date.now() - this._potHistoryLoadedAt < 5 * 60_000) {
      return;
    }
    this._potHistoryLoadedAt = Date.now();
    this._potHistoryStatus = "loading";
    const requestId = ++this._potHistoryRequestId;
    const end = new Date();
    const start = new Date(end.getTime() - this._potHistoryHours * 60 * 60_000);
    const historyRequest = this._callWS<Record<string, HistoryState[]>>({
        type: "history/history_during_period",
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        entity_ids: ids,
        minimal_response: true,
        no_attributes: true,
        significant_changes_only: false,
      });
    const statisticsRequest = this._callWS<Record<string, StatisticState[]>>({
      type: "recorder/statistics_during_period",
      start_time: start.toISOString(),
      end_time: end.toISOString(),
      statistic_ids: ids,
      period: "5minute",
      types: ["mean"],
    });
    if (!historyRequest && !statisticsRequest) {
      // No websocket transport at all: the live buffer is the only source
      // left, and the tile says so rather than staying mysteriously blank.
      this._potHistoryStatus = "live";
      console.warn(
        "[irrigation-schedule-card] sem callWS/connection neste hass; " +
          "usando apenas amostras ao vivo para os sensores de vaso",
      );
      this.requestUpdate();
      return;
    }
    void Promise.allSettled([historyRequest, statisticsRequest])
      .then(([historyResult, statisticsResult]) => {
        if (requestId !== this._potHistoryRequestId || key !== this._potHistoryKey) {
          return;
        }
        const next = new Map<string, number[]>();
        for (const id of ids) {
          const statistics =
            statisticsResult.status === "fulfilled" &&
            Array.isArray(statisticsResult.value?.[id])
              ? statisticsResult.value[id]
              : [];
          const statisticValues = statistics
            .map((state) => state.mean ?? state.state ?? Number.NaN)
            .filter(Number.isFinite);
          const states =
            historyResult.status === "fulfilled" && Array.isArray(historyResult.value?.[id])
              ? historyResult.value[id]
              : [];
          const historyValues = states
            .map((state) => Number.parseFloat(String(state.s ?? state.state ?? "")))
            .filter(Number.isFinite);
          const values = statisticValues.length > 0 ? statisticValues : historyValues;
          next.set(id, values);
        }
        this._potSensorHistory = next;
        const hasValues = [...next.values()].some((values) => values.length > 0);
        const bothFailed =
          historyResult.status === "rejected" &&
          statisticsResult.status === "rejected";
        this._potHistoryStatus = hasValues ? "ready" : bothFailed ? "error" : "empty";
        // Logged on EVERY outcome, not only when both sides fail: a single
        // rejected request used to leave no trace anywhere, so a card that
        // silently drew nothing gave no clue which half was broken.
        const counts = ids
          .map((id) => `${id}=${next.get(id)?.length ?? 0}`)
          .join(" ");
        const describe = (result: PromiseSettledResult<unknown>) =>
          result.status === "rejected" ? result.reason : "ok";
        if (hasValues) {
          console.debug(
            "[irrigation-schedule-card] histórico dos vasos:",
            counts,
            "| history:",
            describe(historyResult),
            "| statistics:",
            describe(statisticsResult),
          );
        } else {
          console.warn(
            "[irrigation-schedule-card] sem histórico para os sensores de vaso " +
              `(janela de ${this._potHistoryHours}h):`,
            counts,
            "| history:",
            describe(historyResult),
            "| statistics:",
            describe(statisticsResult),
          );
        }
        if (bothFailed) {
          this._potHistoryLoadedAt = Date.now() - 4.5 * 60_000;
        }
        this.requestUpdate();
      });
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
    const sensorIds = this._sensorEntityIds();
    const sectionTitle = {
      general: "Configurações gerais",
      reservoir1: "Reservatório 1",
      reservoir2: "Reservatório 2",
      potSensors: "Sensores dos vasos",
    }[this._settingsSection];
    const sectionSubtitle = {
      general: "Parâmetros usados nos cálculos de volume e duração.",
      reservoir1: "Sensores e faixa segura do reservatório principal.",
      reservoir2: "Segundo reservatório opcional e independente.",
      potSensors: "Organize os sensores que aparecem no resumo do período selecionado.",
    }[this._settingsSection];
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
          <div class="settings-header">
            <div class="settings-header-icon"><ha-icon icon="mdi:water-outline"></ha-icon></div>
            <div>
              <small>IRRIGAÇÃO</small>
              <h3 id="irrigation-settings-title">Configurar ${zoneName}</h3>
              <p>Ajuste os parâmetros da zona e os sensores exibidos no card.</p>
            </div>
            <button
              class="settings-close icon-button"
              type="button"
              title="Fechar"
              aria-label="Fechar"
              @click=${this._closeSettings}
            >
              <ha-icon icon="mdi:close"></ha-icon>
            </button>
          </div>
          <div class="settings-layout">
            <nav class="settings-nav" aria-label="Seções das configurações">
              ${this._settingsNavButton("general", "mdi:tune-variant", "Geral")}
              ${this._settingsNavButton("reservoir1", "mdi:cup-water", "Reservatório 1")}
              ${this._settingsNavButton("reservoir2", "mdi:cup-water", "Reservatório 2", true)}
              ${this._settingsNavButton("potSensors", "mdi:water-percent", "Sensores dos vasos")}
            </nav>
            <div class="settings-content">
              <div class="settings-section-heading">
                <h4>${sectionTitle}</h4>
                <p>${sectionSubtitle}</p>
              </div>
              ${this._settingsSection === "general"
                ? this._renderGeneralSettings(
                    defaultDurationMin,
                    flowRate,
                    numberOfPots,
                    reservoirVolume,
                  )
                : this._settingsSection === "reservoir1"
                  ? this._renderReservoirSettings(
                      1,
                      phEntityId,
                      phMin,
                      phMax,
                      ecEntityId,
                      sensorIds,
                    )
                  : this._settingsSection === "reservoir2"
                    ? this._renderReservoirSettings(
                        2,
                        phEntityId2,
                        phMin2,
                        phMax2,
                        ecEntityId2,
                        sensorIds,
                      )
                    : this._renderPotSensorSettings(sensorIds)}
              ${this._settingsError
                ? html`<div class="form-error">${this._settingsError}</div>`
                : ""}
            </div>
          </div>
          <div class="dialog-actions settings-actions">
            <span>${this._settingsDirty() ? "Alterações não salvas" : "Tudo atualizado"}</span>
            <button type="button" class="dialog-cancel" @click=${this._closeSettings}>Cancelar</button>
            <button type="button" class="dialog-save" @click=${this._saveSettings}>
              <ha-icon icon="mdi:content-save-outline"></ha-icon> Salvar alterações
            </button>
          </div>
        </div>
      </div>
    `;
  }

  private _settingsNavButton(
    section: SettingsSection,
    icon: string,
    label: string,
    optional = false,
  ): TemplateResult {
    return html`
      <button
        type="button"
        class=${this._settingsSection === section ? "active" : ""}
        aria-current=${this._settingsSection === section ? "page" : "false"}
        @click=${() => {
          this._settingsSection = section;
          this._settingsError = null;
        }}
      >
        <ha-icon icon=${icon}></ha-icon>
        <span>${label}${optional ? html`<small>Opcional</small>` : ""}</span>
        <ha-icon class="nav-chevron" icon="mdi:chevron-right"></ha-icon>
      </button>
    `;
  }

  private _renderGeneralSettings(
    defaultDurationMin: number,
    flowRate: number,
    numberOfPots: number,
    reservoirVolume: number,
  ): TemplateResult {
    const effectiveDuration =
      Number.parseInt(this._settingsDefaultDuration, 10) || defaultDurationMin;
    const effectiveFlow = Number.isFinite(Number.parseInt(this._settingsFlow, 10))
      ? Number.parseInt(this._settingsFlow, 10)
      : flowRate;
    const effectivePots = Number.isFinite(Number.parseInt(this._settingsPots, 10))
      ? Number.parseInt(this._settingsPots, 10)
      : numberOfPots;
    const perPot = perPotVolumeMl(effectiveFlow, effectiveDuration * 60) ?? 0;
    const total = totalVolumeMl(effectiveFlow, effectiveDuration * 60, effectivePots) ?? 0;
    return html`
      <div class="settings-card-grid field-grid">
        ${this._settingsNumberCard(
          "mdi:timer-outline",
          "Duração padrão",
          "Tempo sugerido ao criar um horário",
          this._settingsDefaultDuration || String(defaultDurationMin),
          "min",
          1,
          this._onSettingsDefaultDurationChange,
        )}
        ${this._settingsNumberCard(
          "mdi:water-pump",
          "Vazão por vaso",
          "Litros entregues por hora em cada vaso",
          this._settingsFlow || String(flowRate),
          "L/h",
          0,
          this._onSettingsFlowChange,
        )}
        ${this._settingsNumberCard(
          "mdi:sprout-outline",
          "Número de vasos",
          "Total atendido por esta zona",
          this._settingsPots || String(numberOfPots),
          "vasos",
          0,
          this._onSettingsPotsChange,
        )}
        ${this._settingsNumberCard(
          "mdi:cup-water",
          "Volume do reservatório",
          "Capacidade usada na estimativa do card",
          this._settingsReservoir || String(reservoirVolume),
          "L",
          0,
          this._onSettingsReservoirChange,
        )}
      </div>
      <div class="settings-estimate">
        <ha-icon icon="mdi:calculator-variant-outline"></ha-icon>
        <div><span>Estimativa por rega</span><strong>${formatMl(perPot)} por vaso</strong></div>
        <div><span>Volume total</span><strong>${formatVolume(total / 1000)}</strong></div>
      </div>
    `;
  }

  private _settingsNumberCard(
    icon: string,
    label: string,
    hint: string,
    value: string,
    suffix: string,
    min: number,
    handler: (ev: Event) => void,
  ): TemplateResult {
    return html`
      <label class="settings-field-card field">
        <span class="settings-field-icon"><ha-icon icon=${icon}></ha-icon></span>
        <span class="settings-field-copy"><strong>${label}</strong><small>${hint}</small></span>
        <span class="settings-input-suffix">
          <input type="number" min=${min} .value=${value} @change=${handler} />
          <span>${suffix}</span>
        </span>
      </label>
    `;
  }

  private _renderReservoirSettings(
    reservoir: 1 | 2,
    phEntityId: string,
    phMin: number,
    phMax: number,
    ecEntityId: string,
    sensorIds: string[],
  ): TemplateResult {
    const second = reservoir === 2;
    const phValue = this._settingsPhValue(second, phEntityId);
    const ecValue = this._settingsEcValue(second, ecEntityId);
    const phInput = second
      ? this._settingsPhEntityTouchedValue(2, phEntityId)
      : this._settingsPhEntityTouchedValue(1, phEntityId);
    const ecInput = second
      ? this._settingsEcEntityTouchedValue(2, ecEntityId)
      : this._settingsEcEntityTouchedValue(1, ecEntityId);
    return html`
      ${second
        ? html`<div class="settings-notice"><ha-icon icon="mdi:information-outline"></ha-icon><span>Use esta seção apenas quando a zona recebe água de um segundo reservatório.</span></div>`
        : ""}
      <div class="reservoir-live-grid">
        <div><ha-icon icon="mdi:flask-outline"></ha-icon><span>pH atual</span><strong>${phValue}</strong></div>
        <div><ha-icon icon="mdi:flash-outline"></ha-icon><span>EC atual</span><strong>${ecValue}</strong></div>
      </div>
      <div class="settings-form-card">
        <label class="field">
          <span>Sensor de pH</span>
          <input
            type="text"
            list=${second ? "ph-sensor-options-2" : "ph-sensor-options"}
            placeholder="sensor.reservatorio_ph"
            .value=${phInput}
            @change=${second ? this._onSettingsPhEntity2Change : this._onSettingsPhEntityChange}
          />
        </label>
        <datalist id=${second ? "ph-sensor-options-2" : "ph-sensor-options"}>
          ${sensorIds.map((id) => html`<option value=${id}></option>`)}
        </datalist>
        <div class="field">
          <span>Faixa de pH para rega agendada</span>
          <div class="duration-row">
            <label class="duration-part"><small>Mínimo</small><input type="number" min="0" max="14" step="0.1" .value=${second ? this._settingsPhMin2 || String(phMin) : this._settingsPhMin || String(phMin)} @change=${second ? this._onSettingsPhMin2Change : this._onSettingsPhMinChange} /></label>
            <span class="range-separator">até</span>
            <label class="duration-part"><small>Máximo</small><input type="number" min="0" max="14" step="0.1" .value=${second ? this._settingsPhMax2 || String(phMax) : this._settingsPhMax || String(phMax)} @change=${second ? this._onSettingsPhMax2Change : this._onSettingsPhMaxChange} /></label>
          </div>
        </div>
        <label class="field">
          <span>Sensor de EC <small>Somente exibição</small></span>
          <input type="text" list=${second ? "ec-sensor-options-2" : "ec-sensor-options"} placeholder="sensor.reservatorio_ec" .value=${ecInput} @change=${second ? this._onSettingsEcEntity2Change : this._onSettingsEcEntityChange} />
        </label>
        <datalist id=${second ? "ec-sensor-options-2" : "ec-sensor-options"}>
          ${sensorIds.map((id) => html`<option value=${id}></option>`)}
        </datalist>
      </div>
    `;
  }

  private _settingsPhEntityTouchedValue(reservoir: 1 | 2, fallback: string): string {
    return reservoir === 1
      ? this._settingsPhEntityTouched
        ? this._settingsPhEntity
        : fallback
      : this._settingsPhEntity2Touched
        ? this._settingsPhEntity2
        : fallback;
  }

  private _settingsEcEntityTouchedValue(reservoir: 1 | 2, fallback: string): string {
    return reservoir === 1
      ? this._settingsEcEntityTouched
        ? this._settingsEcEntity
        : fallback
      : this._settingsEcEntity2Touched
        ? this._settingsEcEntity2
        : fallback;
  }

  private _settingsPhValue(second: boolean, entityId: string): string {
    const configured = second
      ? this._settingsPhEntityTouchedValue(2, entityId)
      : this._settingsPhEntityTouchedValue(1, entityId);
    return configured
      ? this._sensorBadgeText(configured, "—", (value) => value.toFixed(2))
      : "—";
  }

  private _settingsEcValue(second: boolean, entityId: string): string {
    const configured = second
      ? this._settingsEcEntityTouchedValue(2, entityId)
      : this._settingsEcEntityTouchedValue(1, entityId);
    return configured
      ? this._sensorBadgeText(configured, "—", (value, unit) => `${value} ${unit ?? ""}`.trim())
      : "—";
  }

  private _renderPotSensorSettings(sensorIds: string[]): TemplateResult {
    return html`
      <datalist id="pot-sensor-options">
        ${sensorIds.map((id) => {
          const friendlyName = this._stringAttr(this.hass?.states[id], "friendly_name");
          return html`<option value=${id} label=${friendlyName ?? id}></option>`;
        })}
      </datalist>
      <div class="pot-settings-toolbar">
        <span>${this._settingsPotSensors.length} sensores configurados</span>
        <button type="button" @click=${this._addPotSensor}><ha-icon icon="mdi:plus"></ha-icon>Adicionar sensor</button>
      </div>
      <div class="pot-settings-list">
        ${this._settingsPotSensors.length === 0
          ? html`<div class="pot-settings-empty"><ha-icon icon="mdi:water-percent"></ha-icon><strong>Nenhum sensor configurado</strong><span>Adicione os sensores de amostragem das fileiras ou mesas.</span></div>`
          : this._settingsPotSensors.map(
              (sensor, index) => html`
                <div class="pot-settings-row" draggable="true" @dragstart=${(ev: DragEvent) => this._startPotDrag(index, ev)} @dragover=${(ev: DragEvent) => ev.preventDefault()} @drop=${() => this._dropPotSensor(index)}>
                  <ha-icon class="drag-handle" icon="mdi:drag-vertical"></ha-icon>
                  <span class="pot-order">${index + 1}</span>
                  <label><span>Nome exibido</span><input type="text" maxlength="64" .value=${sensor.name} @input=${(ev: Event) => this._updatePotSensor(index, "name", (ev.target as HTMLInputElement).value)} /></label>
                  <label>
                    <span>Entidade — digite para buscar</span>
                    <input
                      class="pot-entity-input"
                      type="search"
                      list="pot-sensor-options"
                      autocomplete="off"
                      spellcheck="false"
                      placeholder="Digite o nome ou entity_id…"
                      .value=${sensor.entity_id}
                      @change=${(ev: Event) =>
                        this._updatePotSensor(
                          index,
                          "entity_id",
                          (ev.target as HTMLInputElement).value.trim(),
                        )}
                    />
                  </label>
                  <div class="pot-row-actions"><button type="button" title="Mover para cima" ?disabled=${index === 0} @click=${() => this._movePotSensor(index, index - 1)}><ha-icon icon="mdi:chevron-up"></ha-icon></button><button type="button" title="Mover para baixo" ?disabled=${index === this._settingsPotSensors.length - 1} @click=${() => this._movePotSensor(index, index + 1)}><ha-icon icon="mdi:chevron-down"></ha-icon></button><button type="button" class="remove" title="Remover sensor" @click=${() => this._removePotSensor(index)}><ha-icon icon="mdi:trash-can-outline"></ha-icon></button></div>
                </div>
              `,
            )}
      </div>
    `;
  }

  private _settingsDirty(): boolean {
    return Boolean(
      this._settingsDefaultDuration ||
        this._settingsFlow ||
        this._settingsPots ||
        this._settingsReservoir ||
        this._settingsPhEntityTouched ||
        this._settingsPhMin ||
        this._settingsPhMax ||
        this._settingsEcEntityTouched ||
        this._settingsPhEntity2Touched ||
        this._settingsPhMin2 ||
        this._settingsPhMax2 ||
        this._settingsEcEntity2Touched ||
        this._settingsPotSensorsTouched,
    );
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
      this._settingsSection = "general";
      this._settingsPotSensors = this._potSensorsAttr(this._sensorEntity).map((item) => ({
        ...item,
      }));
      this._settingsPotSensorsTouched = false;
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
    this._settingsSection = "general";
    this._settingsPotSensors = [];
    this._settingsPotSensorsTouched = false;
    this._draggedPotIndex = null;
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

  private _addPotSensor(): void {
    this._settingsPotSensors = [
      ...this._settingsPotSensors,
      { name: `Fileira ${this._settingsPotSensors.length + 1}`, entity_id: "" },
    ];
    this._settingsPotSensorsTouched = true;
    this._settingsError = null;
  }

  private _updatePotSensor(
    index: number,
    field: keyof PotSensorConfig,
    value: string,
  ): void {
    this._settingsPotSensors = this._settingsPotSensors.map((item, itemIndex) =>
      itemIndex === index ? { ...item, [field]: value } : item,
    );
    this._settingsPotSensorsTouched = true;
    this._settingsError = null;
  }

  private _removePotSensor(index: number): void {
    this._settingsPotSensors = this._settingsPotSensors.filter(
      (_item, itemIndex) => itemIndex !== index,
    );
    this._settingsPotSensorsTouched = true;
    this._settingsError = null;
  }

  private _movePotSensor(from: number, to: number): void {
    if (from < 0 || to < 0 || from >= this._settingsPotSensors.length || to >= this._settingsPotSensors.length || from === to) {
      return;
    }
    const next = [...this._settingsPotSensors];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    this._settingsPotSensors = next;
    this._settingsPotSensorsTouched = true;
  }

  private _startPotDrag(index: number, ev: DragEvent): void {
    this._draggedPotIndex = index;
    ev.dataTransfer?.setData("text/plain", String(index));
    if (ev.dataTransfer) {
      ev.dataTransfer.effectAllowed = "move";
    }
  }

  private _dropPotSensor(index: number): void {
    if (this._draggedPotIndex !== null) {
      this._movePotSensor(this._draggedPotIndex, index);
    }
    this._draggedPotIndex = null;
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
    if (this._settingsPotSensorsTouched) {
      const normalized = this._settingsPotSensors.map((item) => ({
        name: item.name.trim(),
        entity_id: item.entity_id.trim(),
      }));
      if (normalized.some((item) => !item.name || !item.entity_id)) {
        this._settingsSection = "potSensors";
        this._settingsError = "Preencha o nome e a entidade de todos os sensores.";
        return;
      }
      if (normalized.some((item) => !item.entity_id.startsWith("sensor."))) {
        this._settingsSection = "potSensors";
        this._settingsError =
          "Escolha uma entidade de sensor válida nas sugestões da busca.";
        return;
      }
      const ids = normalized.map((item) => item.entity_id);
      if (new Set(ids).size !== ids.length) {
        this._settingsSection = "potSensors";
        this._settingsError = "Cada entidade pode ser usada apenas uma vez.";
        return;
      }
      data.pot_sensors = normalized;
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
      this._showServiceError(error);
    });
  }

  private _showServiceError(error: unknown): void {
    this.dispatchEvent(
      new CustomEvent("hass-notification", {
        detail: { message: this._describeServiceError(error) },
        bubbles: true,
        composed: true,
      }),
    );
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
    const desired = !schedule.enabled;
    this._scheduleEnabledOverrides.set(schedule.id, desired);
    this.requestUpdate();
    void this._callService("update_schedule", {
      id: schedule.id,
      enabled: desired,
    }).catch((error: unknown) => {
      if (this._scheduleEnabledOverrides.get(schedule.id) === desired) {
        this._scheduleEnabledOverrides.delete(schedule.id);
        this.requestUpdate();
      }
      this._showServiceError(error);
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

console.info(`[irrigation-schedule-card] build ${CARD_BUILD}`);

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
