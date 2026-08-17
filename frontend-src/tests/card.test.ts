import { render } from "lit";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { IrrigationScheduleCard, validateCardConfig } from "../src/card";
import { DOMAIN } from "../src/const";
import type { HassEntity, HistoryRun, HomeAssistant } from "../src/types";
import type { HistoryDayGroup } from "../src/utils";

const VALID_CONFIG = {
  type: "custom:irrigation-schedule-card",
  entity: "sensor.jardim_next_run",
};

function makeCard(): IrrigationScheduleCard {
  return document.createElement(
    "irrigation-schedule-card",
  ) as IrrigationScheduleCard;
}

interface ServiceCallRecord {
  domain: string;
  service: string;
  data: Record<string, unknown>;
  target?: { entity_id?: string | string[] };
}

function makeHass(
  states: Record<string, HassEntity>,
  calls: ServiceCallRecord[],
): HomeAssistant {
  return {
    language: "pt-BR",
    locale: { language: "pt-BR" },
    states,
    callService: async (domain, service, data = {}, target) => {
      calls.push({ domain, service, data, target });
    },
  };
}

const attachedCards: IrrigationScheduleCard[] = [];

/** Create, configure and attach a card to the DOM; awaits its first render. */
async function mountCard(
  states: Record<string, HassEntity>,
  calls: ServiceCallRecord[],
): Promise<IrrigationScheduleCard> {
  const card = makeCard();
  card.hass = makeHass(states, calls);
  card.setConfig({ ...VALID_CONFIG });
  document.body.appendChild(card);
  attachedCards.push(card);
  await card.updateComplete;
  return card;
}

function dispatchChange(input: HTMLInputElement, value: string): void {
  input.value = value;
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

afterEach(() => {
  for (const card of attachedCards.splice(0)) {
    card.remove();
  }
});

describe("validateCardConfig", () => {
  it("throws for non-object config", () => {
    expect(() => validateCardConfig(null)).toThrow(
      "Configuração inválida para o card de irrigação.",
    );
    expect(() => validateCardConfig("nope")).toThrow(
      "Configuração inválida para o card de irrigação.",
    );
    expect(() => validateCardConfig(undefined)).toThrow(
      "Configuração inválida para o card de irrigação.",
    );
  });

  it("throws when entity is missing or not a sensor", () => {
    expect(() => validateCardConfig({ type: VALID_CONFIG.type })).toThrow(
      'O card exige um sensor da integração: "sensor.<zona>_next_run".',
    );
    expect(() => validateCardConfig({ entity: "switch.abc" })).toThrow(
      'O card exige um sensor da integração: "sensor.<zona>_next_run".',
    );
    expect(() => validateCardConfig({ entity: "" })).toThrow(
      'O card exige um sensor da integração: "sensor.<zona>_next_run".',
    );
    expect(() => validateCardConfig({ entity: 42 })).toThrow(
      'O card exige um sensor da integração: "sensor.<zona>_next_run".',
    );
  });

  it("accepts a valid sensor config", () => {
    expect(() => validateCardConfig(VALID_CONFIG)).not.toThrow();
  });
});

describe("IrrigationScheduleCard.setConfig", () => {
  it("throws for config without entity", () => {
    const card = makeCard();
    expect(() => card.setConfig({ type: VALID_CONFIG.type })).toThrow(
      'O card exige um sensor da integração: "sensor.<zona>_next_run".',
    );
  });

  it("throws for entity that is not a sensor", () => {
    const card = makeCard();
    expect(() =>
      card.setConfig({ type: VALID_CONFIG.type, entity: "switch.abc" }),
    ).toThrow('O card exige um sensor da integração: "sensor.<zona>_next_run".');
  });

  it("accepts a valid config and spreads it", () => {
    const card = makeCard();
    card.setConfig({ ...VALID_CONFIG, compact: true });
    expect(card.getCardSize()).toBe(2);
  });
});

function baseSensor(overrides: Partial<HassEntity["attributes"]> = {}): HassEntity {
  return {
    entity_id: "sensor.jardim_next_run",
    state: "2026-08-13T09:00:00+00:00",
    last_changed: "",
    last_updated: "",
    attributes: {
      friendly_name: "Jardim next run",
      schedules: [
        {
          id: "s1",
          time: "06:00:00",
          days: [0, 1, 2, 3, 4, 5, 6],
          duration: 600,
          enabled: true,
        },
        {
          id: "s2",
          time: "18:00:00",
          days: [0, 1, 2, 3, 4, 5, 6],
          duration: 600,
          enabled: true,
        },
      ],
      target_entity_id: "switch.jardim",
      default_duration: 600,
      max_duration: 7200,
      flow_rate_lph: 0,
      number_of_pots: 0,
      reservoir_volume_l: 0,
      ph_entity_id: "",
      ph_min: 0,
      ph_max: 14,
      ec_entity_id: "",
      schedule_warnings: {},
      switch_entity_id: "switch.jardim_schedule_enabled",
      binary_sensor_entity_id: "binary_sensor.jardim_watering",
      ...overrides,
    },
  };
}

function historyRun(overrides: Partial<HistoryRun> = {}): HistoryRun {
  return {
    started_at: "2026-08-13T06:00:00+00:00",
    finishes_at: "2026-08-13T06:10:00+00:00",
    duration: 600,
    source: "schedule",
    schedule_id: "s1",
    flow_rate_lph: 8,
    number_of_pots: 12,
    ph_value: null,
    ec_value: null,
    ec_unit: null,
    ph_value_2: null,
    ec_value_2: null,
    ec_unit_2: null,
    ...overrides,
  };
}

function baseBinarySensor(overrides: Partial<HassEntity["attributes"]> = {}): HassEntity {
  return {
    entity_id: "binary_sensor.jardim_watering",
    state: "off",
    last_changed: "",
    last_updated: "",
    attributes: {
      started_at: null,
      finishes_at: null,
      duration: null,
      source: null,
      schedule_id: null,
      last_run: null,
      history: [],
      ...overrides,
    },
  };
}

describe("IrrigationScheduleCard schedule pH warning badge", () => {
  it("flags only the schedule present in schedule_warnings", async () => {
    const sensor = baseSensor({
      schedule_warnings: { s1: "pH 7.8 acima do máximo (6.5)" },
    });
    const card = await mountCard({ "sensor.jardim_next_run": sensor }, []);

    const rows = card.shadowRoot?.querySelectorAll(".schedule-row") ?? [];
    expect(rows).toHaveLength(2);
    expect(rows[0].querySelector(".warning-icon")).not.toBeNull();
    expect(rows[1].querySelector(".warning-icon")).toBeNull();
    expect(rows[0].querySelector(".warning-icon")?.getAttribute("title")).toContain(
      "pH 7.8",
    );
  });

  it("shows no warning badges when schedule_warnings is empty", async () => {
    const card = await mountCard({ "sensor.jardim_next_run": baseSensor() }, []);
    expect(card.shadowRoot?.querySelectorAll(".warning-icon")).toHaveLength(0);
  });
});

describe("IrrigationScheduleCard schedule day indicator", () => {
  it("always renders all 7 day letters, marking only the selected days active", async () => {
    const sensor = baseSensor({
      schedules: [
        { id: "s1", time: "06:00:00", days: [0, 2, 4], duration: 600, enabled: true },
      ],
    });
    const card = await mountCard({ "sensor.jardim_next_run": sensor }, []);

    const letters = Array.from(
      card.shadowRoot?.querySelectorAll(".schedule-row .day-initial") ?? [],
    );
    expect(letters).toHaveLength(7);
    expect(letters.map((el) => el.textContent?.trim())).toEqual([
      "S",
      "T",
      "Q",
      "Q",
      "S",
      "S",
      "D",
    ]);
    expect(letters.map((el) => el.classList.contains("active"))).toEqual([
      true,
      false,
      true,
      false,
      true,
      false,
      false,
    ]);
  });
});

describe("IrrigationScheduleCard settings panel pH gate", () => {
  function openSettings(card: IrrigationScheduleCard): HTMLElement {
    const cog = card.shadowRoot?.querySelector(
      'button.icon-button[title="Configurar vazão e vasos"]',
    ) as HTMLElement;
    cog.click();
    return cog;
  }

  it("only sends ph_entity_id when the field was actually edited", async () => {
    const calls: ServiceCallRecord[] = [];
    const card = await mountCard({ "sensor.jardim_next_run": baseSensor() }, calls);

    openSettings(card);
    await card.updateComplete;

    const phInput = card.shadowRoot?.querySelector(
      'input[list="ph-sensor-options"]',
    ) as HTMLInputElement;
    expect(phInput).not.toBeNull();
    dispatchChange(phInput, "sensor.reservatorio_ph");
    await card.updateComplete;

    const saveButton = card.shadowRoot?.querySelector(
      ".settings-dialog .dialog-save",
    ) as HTMLButtonElement;
    saveButton.click();
    await card.updateComplete;

    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      domain: "irrigation_scheduler",
      service: "set_zone_options",
      data: { ph_entity_id: "sensor.reservatorio_ph" },
    });
    // flow/pots/reservoir/ph_min/ph_max were never touched: not sent.
    expect(calls[0].data).not.toHaveProperty("flow_rate_lph");
    expect(calls[0].data).not.toHaveProperty("ph_min");
    expect(calls[0].data).not.toHaveProperty("ph_max");
  });

  it("blocks saving and shows an error when ph_min > ph_max, without calling the service", async () => {
    const calls: ServiceCallRecord[] = [];
    const card = await mountCard(
      { "sensor.jardim_next_run": baseSensor({ ph_entity_id: "sensor.ph1" }) },
      calls,
    );

    openSettings(card);
    await card.updateComplete;

    const numberInputs = card.shadowRoot?.querySelectorAll(
      '.settings-dialog .duration-row input[type="number"]',
    ) as NodeListOf<HTMLInputElement>;
    // 4 = R1 min/max + R2 min/max; the first pair (index 0/1) is R1's.
    expect(numberInputs).toHaveLength(4);
    dispatchChange(numberInputs[0], "7"); // ph_min (R1)
    dispatchChange(numberInputs[1], "6"); // ph_max (R1)
    await card.updateComplete;

    const saveButton = card.shadowRoot?.querySelector(
      ".settings-dialog .dialog-save",
    ) as HTMLButtonElement;
    saveButton.click();
    await card.updateComplete;

    expect(calls).toHaveLength(0);
    expect(card.shadowRoot?.querySelector(".settings-dialog .form-error")?.textContent).toContain(
      "mínimo",
    );
    // The panel stays open so the user can fix the values.
    expect(card.shadowRoot?.querySelector(".settings-dialog")).not.toBeNull();
  });

  it("only sends ec_entity_id when the field was actually edited", async () => {
    const calls: ServiceCallRecord[] = [];
    const card = await mountCard({ "sensor.jardim_next_run": baseSensor() }, calls);

    openSettings(card);
    await card.updateComplete;

    const ecInput = card.shadowRoot?.querySelector(
      'input[list="ec-sensor-options"]',
    ) as HTMLInputElement;
    expect(ecInput).not.toBeNull();
    dispatchChange(ecInput, "sensor.reservatorio_ec");
    await card.updateComplete;

    (
      card.shadowRoot?.querySelector(".settings-dialog .dialog-save") as HTMLButtonElement
    ).click();
    await card.updateComplete;

    expect(calls).toHaveLength(1);
    expect(calls[0].data).toEqual({ ec_entity_id: "sensor.reservatorio_ec" });
  });

  it("converts the default duration field from minutes to seconds when saving", async () => {
    const calls: ServiceCallRecord[] = [];
    const card = await mountCard(
      { "sensor.jardim_next_run": baseSensor({ default_duration: 600 }) },
      calls,
    );

    openSettings(card);
    await card.updateComplete;

    const durationInput = card.shadowRoot?.querySelector(
      ".settings-dialog .field input[type='number']",
    ) as HTMLInputElement;
    expect(durationInput.value).toBe("10"); // 600s displayed as 10 minutes
    dispatchChange(durationInput, "15");
    await card.updateComplete;

    (
      card.shadowRoot?.querySelector(".settings-dialog .dialog-save") as HTMLButtonElement
    ).click();
    await card.updateComplete;

    expect(calls).toHaveLength(1);
    expect(calls[0].data).toMatchObject({ default_duration: 900 });
  });

  it("closing via the cog resets the form, same as the Fechar button", async () => {
    const card = await mountCard({ "sensor.jardim_next_run": baseSensor() }, []);
    const cog = openSettings(card);
    await card.updateComplete;

    const durationInput = card.shadowRoot?.querySelector(
      ".settings-dialog .field input[type='number']",
    ) as HTMLInputElement;
    dispatchChange(durationInput, "42");
    await card.updateComplete;

    const withState = card as unknown as {
      _settingsOpen: boolean;
      _settingsDefaultDuration: string;
    };
    expect(withState._settingsDefaultDuration).toBe("42");

    cog.click(); // close via the cog, not "Fechar"
    await card.updateComplete;

    expect(withState._settingsOpen).toBe(false);
    expect(withState._settingsDefaultDuration).toBe("");
  });
});

describe("IrrigationScheduleCard pH/EC header badges", () => {
  it("shows live pH/EC readings next to the title, formatted with their unit", async () => {
    const card = await mountCard(
      {
        "sensor.jardim_next_run": baseSensor({
          ph_entity_id: "sensor.reservatorio_ph",
          ec_entity_id: "sensor.reservatorio_ec",
        }),
        "sensor.reservatorio_ph": {
          entity_id: "sensor.reservatorio_ph",
          state: "6.234",
          last_changed: "",
          last_updated: "",
          attributes: {},
        },
        "sensor.reservatorio_ec": {
          entity_id: "sensor.reservatorio_ec",
          state: "812.4",
          last_changed: "",
          last_updated: "",
          attributes: { unit_of_measurement: "µS/cm" },
        },
      },
      [],
    );

    const phBadge = card.shadowRoot?.querySelector(".ph-metric");
    const ecBadge = card.shadowRoot?.querySelector(".ec-metric");
    // The tile carries the label ("pH"/"EC") in its own <small>, so the
    // value is bare -- no fixed "PH" suffix duplicating the label, and no
    // sensor unit_of_measurement for pH (often itself "pH"). EC keeps its
    // real unit, which is data rather than a label.
    expect(phBadge?.querySelector("small")?.textContent?.trim()).toBe("pH");
    expect(phBadge?.querySelector("strong")?.textContent?.trim()).toBe("6.23");
    expect(ecBadge?.querySelector("small")?.textContent?.trim()).toBe("EC");
    expect(ecBadge?.querySelector("strong")?.textContent?.trim()).toBe(
      "812.4 µS/cm",
    );
    // ph_min/ph_max default to 0/14 in baseSensor(): 6.234 is in range.
    expect(phBadge?.classList.contains("in-range")).toBe(true);
  });

  it("colors the pH badge out-of-range when the reading is outside ph_min/ph_max", async () => {
    const card = await mountCard(
      {
        "sensor.jardim_next_run": baseSensor({
          ph_entity_id: "sensor.reservatorio_ph",
          ph_min: 5.5,
          ph_max: 6.5,
        }),
        "sensor.reservatorio_ph": {
          entity_id: "sensor.reservatorio_ph",
          state: "7.8",
          last_changed: "",
          last_updated: "",
          attributes: { unit_of_measurement: "pH" },
        },
      },
      [],
    );

    const phBadge = card.shadowRoot?.querySelector(".ph-metric");
    // The sensor's own unit ("pH") is ignored: the tile's label says it.
    expect(phBadge?.querySelector("strong")?.textContent?.trim()).toBe("7.8");
    expect(phBadge?.classList.contains("out-of-range")).toBe(true);
    expect(phBadge?.classList.contains("in-range")).toBe(false);
  });

  it("shows a '?' badge (still clickable) when the configured entity is missing", async () => {
    const card = await mountCard(
      {
        "sensor.jardim_next_run": baseSensor({
          ph_entity_id: "sensor.does_not_exist",
        }),
      },
      [],
    );
    const tile = card.shadowRoot?.querySelector(".ph-metric");
    expect(tile).not.toBeNull();
    expect(tile?.querySelector("strong")?.textContent?.trim()).toBe("?");
  });

  it("renders no badges when neither ph_entity_id nor ec_entity_id is configured", async () => {
    const card = await mountCard({ "sensor.jardim_next_run": baseSensor() }, []);
    expect(card.shadowRoot?.querySelector(".ph-metric")).toBeNull();
    expect(card.shadowRoot?.querySelector(".ec-metric")).toBeNull();
  });

  it("clicking the pH badge dispatches hass-more-info for that entity (opens HA's native history dialog)", async () => {
    const card = await mountCard(
      {
        "sensor.jardim_next_run": baseSensor({
          ph_entity_id: "sensor.reservatorio_ph",
        }),
        "sensor.reservatorio_ph": {
          entity_id: "sensor.reservatorio_ph",
          state: "6.2",
          last_changed: "",
          last_updated: "",
          attributes: {},
        },
      },
      [],
    );

    const events: CustomEvent[] = [];
    document.addEventListener("hass-more-info", (ev) =>
      events.push(ev as CustomEvent),
    );

    (card.shadowRoot?.querySelector(".ph-metric") as HTMLButtonElement).click();

    expect(events).toHaveLength(1);
    expect(events[0].detail).toEqual({ entityId: "sensor.reservatorio_ph" });
  });
});

describe("IrrigationScheduleCard R2 (second reservoir) badges", () => {
  it("renders R1 and R2 pH/EC badges in their own labeled rows, no R2 text suffix", async () => {
    const card = await mountCard(
      {
        "sensor.jardim_next_run": baseSensor({
          ph_entity_id: "sensor.r1_ph",
          ec_entity_id: "sensor.r1_ec",
          ph_entity_id_2: "sensor.r2_ph",
          ec_entity_id_2: "sensor.r2_ec",
        }),
        "sensor.r1_ph": {
          entity_id: "sensor.r1_ph",
          state: "6.0",
          last_changed: "",
          last_updated: "",
          attributes: {},
        },
        "sensor.r1_ec": {
          entity_id: "sensor.r1_ec",
          state: "800",
          last_changed: "",
          last_updated: "",
          attributes: { unit_of_measurement: "µS/cm" },
        },
        "sensor.r2_ph": {
          entity_id: "sensor.r2_ph",
          state: "6.4",
          last_changed: "",
          last_updated: "",
          attributes: {},
        },
        "sensor.r2_ec": {
          entity_id: "sensor.r2_ec",
          state: "1200",
          last_changed: "",
          last_updated: "",
          attributes: { unit_of_measurement: "µS/cm" },
        },
      },
      [],
    );

    const phTiles = card.shadowRoot?.querySelectorAll(".ph-metric");
    const ecTiles = card.shadowRoot?.querySelectorAll(".ec-metric");
    expect(phTiles).toHaveLength(2);
    expect(ecTiles).toHaveLength(2);
    // With two reservoirs the tile label carries the disambiguating suffix,
    // so no separate "R1"/"R2" pill is needed.
    const label = (el: Element | undefined) =>
      el?.querySelector("small")?.textContent?.trim();
    const value = (el: Element | undefined) =>
      el?.querySelector("strong")?.textContent?.trim();
    expect(label(phTiles?.[0])).toBe("pH R1");
    expect(label(phTiles?.[1])).toBe("pH R2");
    expect(label(ecTiles?.[0])).toBe("EC R1");
    expect(label(ecTiles?.[1])).toBe("EC R2");
    expect(value(phTiles?.[0])).toBe("6");
    expect(value(phTiles?.[1])).toBe("6.4");
    expect(value(ecTiles?.[0])).toBe("800 µS/cm");
    expect(value(ecTiles?.[1])).toBe("1200 µS/cm");
  });

  it("lays out the pH/EC tiles R1-then-R2 in the metrics grid", async () => {
    const card = await mountCard(
      {
        "sensor.jardim_next_run": baseSensor({
          ph_entity_id: "sensor.r1_ph",
          ec_entity_id: "sensor.r1_ec",
          ph_entity_id_2: "sensor.r2_ph",
          ec_entity_id_2: "sensor.r2_ec",
        }),
      },
      [],
    );
    const tiles = Array.from(
      card.shadowRoot?.querySelector(".metrics")?.children ?? [],
    );
    // DOM order is R1's pH/EC then R2's; the two-column CSS grid puts each
    // reservoir on its own visual row -- see .metrics.
    expect(tiles).toHaveLength(4);
    expect(tiles.map((el) => el.className.split(" ")[1])).toEqual([
      "ph-metric",
      "ec-metric",
      "ph-metric",
      "ec-metric",
    ]);
    const labels = tiles.map((el) =>
      el.querySelector("small")?.textContent?.trim(),
    );
    expect(labels).toEqual(["pH R1", "EC R1", "pH R2", "EC R2"]);
  });

  it("shows the reservoir level ONCE even with two reservoirs configured", async () => {
    const card = await mountCard(
      {
        "sensor.jardim_next_run": baseSensor({
          ph_entity_id: "sensor.r1_ph",
          ph_entity_id_2: "sensor.r2_ph",
          reservoir_volume_l: 1000,
        }),
      },
      [],
    );
    // Only the pH/EC readings are per-reservoir; the zone tracks a single
    // volume, so the level block renders once rather than per pH row.
    const levels = card.shadowRoot?.querySelectorAll(".reservoir-level");
    expect(levels).toHaveLength(1);
    expect(
      levels?.[0].querySelector("strong")?.textContent?.trim(),
    ).toBe("1000/1000 L");
    expect(card.shadowRoot?.querySelectorAll(".refill-button")).toHaveLength(1);
  });

  it("does not show the reservoir level when reservoir_volume_l is not configured", async () => {
    const card = await mountCard(
      { "sensor.jardim_next_run": baseSensor({ ph_entity_id: "sensor.r1_ph" }) },
      [],
    );
    expect(card.shadowRoot?.querySelectorAll(".reservoir-level")).toHaveLength(0);
  });

  it("does not render R2 badges when R2 is not configured", async () => {
    const card = await mountCard(
      {
        "sensor.jardim_next_run": baseSensor({
          ph_entity_id: "sensor.r1_ph",
          ec_entity_id: "sensor.r1_ec",
        }),
      },
      [],
    );
    expect(card.shadowRoot?.querySelectorAll(".ph-metric")).toHaveLength(1);
    expect(card.shadowRoot?.querySelectorAll(".ec-metric")).toHaveLength(1);
  });

  it("shows the reservoir row (volume/estimate/refill) even without any pH/EC sensor configured", async () => {
    const card = await mountCard(
      {
        "sensor.jardim_next_run": baseSensor({
          reservoir_volume_l: 1000,
          flow_rate_lph: 8,
        }),
      },
      [],
    );
    expect(card.shadowRoot?.querySelector(".reservoir-level")).not.toBeNull();
    expect(card.shadowRoot?.querySelector(".refill-button")).not.toBeNull();
  });

  it("labels the tile plain 'pH' when only one reservoir is shown", async () => {
    const card = await mountCard(
      {
        "sensor.jardim_next_run": baseSensor({
          ph_entity_id: "sensor.r1_ph",
          reservoir_volume_l: 1000,
        }),
      },
      [],
    );
    const tile = card.shadowRoot?.querySelector(".ph-metric");
    expect(tile).not.toBeNull();
    // No "R1" suffix: with a single reservoir there is nothing to
    // disambiguate against.
    expect(tile?.querySelector("small")?.textContent?.trim()).toBe("pH");
    expect(card.shadowRoot?.querySelector(".reservoir-level")).not.toBeNull();
  });

  it("suffixes the tile labels R1/R2 only when both reservoirs are shown", async () => {
    const card = await mountCard(
      {
        "sensor.jardim_next_run": baseSensor({
          ph_entity_id: "sensor.r1_ph",
          ph_entity_id_2: "sensor.r2_ph",
        }),
      },
      [],
    );
    const labels = Array.from(
      card.shadowRoot?.querySelectorAll(".ph-metric small") ?? [],
    ).map((el) => el.textContent?.trim());
    expect(labels).toEqual(["pH R1", "pH R2"]);
  });

  it("_saveSettings sends R2 fields only when their inputs were touched", async () => {
    const calls: ServiceCallRecord[] = [];
    const card = await mountCard(
      { "sensor.jardim_next_run": baseSensor() },
      calls,
    );
    const withState = card as unknown as {
      _settingsOpen: boolean;
      _settingsPhEntity2: string;
      _settingsPhEntity2Touched: boolean;
      _saveSettings: () => void;
    };
    withState._settingsOpen = true;
    withState._settingsPhEntity2 = "sensor.r2_ph";
    withState._settingsPhEntity2Touched = true;
    withState._saveSettings();
    await Promise.resolve();
    await Promise.resolve();

    expect(calls).toHaveLength(1);
    expect(calls[0].data).toMatchObject({ ph_entity_id_2: "sensor.r2_ph" });
    expect(calls[0].data).not.toHaveProperty("ph_entity_id");
    expect(calls[0].data).not.toHaveProperty("ph_min_2");
  });
});

describe("IrrigationScheduleCard reservoir consumption tracking", () => {
  it("shows remaining/total when reservoir_remaining_l is present", async () => {
    const card = await mountCard(
      {
        "sensor.jardim_next_run": baseSensor({
          ph_entity_id: "sensor.r1_ph",
          reservoir_volume_l: 1000,
          reservoir_remaining_l: 620,
        }),
      },
      [],
    );
    const level = card.shadowRoot?.querySelector(".reservoir-level");
    expect(level?.querySelector("strong")?.textContent?.trim()).toBe(
      "620/1000 L",
    );
  });

  it("falls back to full capacity when reservoir_remaining_l is absent", async () => {
    const card = await mountCard(
      {
        "sensor.jardim_next_run": baseSensor({
          ph_entity_id: "sensor.r1_ph",
          reservoir_volume_l: 1000,
        }),
      },
      [],
    );
    const level = card.shadowRoot?.querySelector(".reservoir-level");
    expect(level?.querySelector("strong")?.textContent?.trim()).toBe(
      "1000/1000 L",
    );
  });

  it("shows a time-until-empty estimate when there is an enabled schedule", async () => {
    const card = await mountCard(
      {
        "sensor.jardim_next_run": baseSensor({
          ph_entity_id: "sensor.r1_ph",
          reservoir_volume_l: 1000,
          reservoir_remaining_l: 1000,
          flow_rate_lph: 60,
          number_of_pots: 1,
          schedules: [
            {
              id: "s1",
              time: "06:00:00",
              days: [0, 1, 2, 3, 4, 5, 6],
              duration: 3600,
              enabled: true,
            },
          ],
        }),
      },
      [],
    );
    // 60 L/h * 1h * 7 days/week -> 60 L/day avg -> 1000/60 ~= 16.7 days.
    const caption = card.shadowRoot?.querySelector(".reservoir-level small");
    expect(caption?.textContent?.replace(/\s+/g, " ").trim()).toBe(
      "Volume · restam ~17 dias",
    );
  });

  it("hides the estimate when there is no enabled schedule (avg consumption is 0)", async () => {
    const card = await mountCard(
      {
        "sensor.jardim_next_run": baseSensor({
          ph_entity_id: "sensor.r1_ph",
          reservoir_volume_l: 1000,
          reservoir_remaining_l: 500,
          flow_rate_lph: 0,
        }),
      },
      [],
    );
    const caption = card.shadowRoot?.querySelector(".reservoir-level small");
    expect(caption?.textContent?.replace(/\s+/g, " ").trim()).toBe("Volume");
  });

  it("does not show a refill button when reservoir_volume_l is not configured", async () => {
    const card = await mountCard(
      { "sensor.jardim_next_run": baseSensor({ ph_entity_id: "sensor.r1_ph" }) },
      [],
    );
    expect(card.shadowRoot?.querySelector(".refill-button")).toBeNull();
  });

  it("renders remaining/estimate/refill once, not per reservoir", async () => {
    const card = await mountCard(
      {
        "sensor.jardim_next_run": baseSensor({
          ph_entity_id: "sensor.r1_ph",
          ph_entity_id_2: "sensor.r2_ph",
          reservoir_volume_l: 1000,
          reservoir_remaining_l: 620,
        }),
      },
      [],
    );
    // The zone tracks ONE volume; only the pH/EC readings are per physical
    // reservoir. The old layout duplicated these to fill a shared badge
    // grid -- the level block now stands on its own below the tiles.
    expect(card.shadowRoot?.querySelectorAll(".reservoir-level")).toHaveLength(1);
    expect(card.shadowRoot?.querySelectorAll(".refill-button")).toHaveLength(1);
  });

  it("_refillReservoir calls the refill_reservoir service after confirmation", async () => {
    const calls: ServiceCallRecord[] = [];
    const card = await mountCard(
      {
        "sensor.jardim_next_run": baseSensor({
          ph_entity_id: "sensor.r1_ph",
          reservoir_volume_l: 1000,
          reservoir_remaining_l: 400,
        }),
      },
      calls,
    );
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const button = card.shadowRoot?.querySelector(
      ".refill-button",
    ) as HTMLButtonElement | null;
    button?.click();
    await Promise.resolve();

    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      domain: "irrigation_scheduler",
      service: "refill_reservoir",
    });
  });

  it("_refillReservoir does nothing when the confirmation is declined", async () => {
    const calls: ServiceCallRecord[] = [];
    const card = await mountCard(
      {
        "sensor.jardim_next_run": baseSensor({
          ph_entity_id: "sensor.r1_ph",
          reservoir_volume_l: 1000,
          reservoir_remaining_l: 400,
        }),
      },
      calls,
    );
    vi.spyOn(window, "confirm").mockReturnValue(false);
    const button = card.shadowRoot?.querySelector(
      ".refill-button",
    ) as HTMLButtonElement | null;
    button?.click();
    await Promise.resolve();

    expect(calls).toHaveLength(0);
  });
});

describe("IrrigationScheduleCard last run + history dialog", () => {
  beforeEach(() => {
    // Fake ONLY Date: Lit's own update scheduling relies on real
    // microtask/timer machinery, which a blanket useFakeTimers() would also
    // freeze, silently leaving re-renders (e.g. after opening the dialog)
    // stuck pending until timers are advanced.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-08-13T09:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows no last-run row when there is no history yet", async () => {
    const card = await mountCard(
      {
        "sensor.jardim_next_run": baseSensor(),
        "binary_sensor.jardim_watering": baseBinarySensor(),
      },
      [],
    );
    expect(card.shadowRoot?.querySelector(".last-run")).toBeNull();
  });

  it("shows 'ativada no dispositivo' in the live watering bar for an external run", async () => {
    const now = new Date();
    const watering: HassEntity = {
      entity_id: "binary_sensor.jardim_watering",
      state: "on",
      last_changed: "",
      last_updated: "",
      attributes: {
        started_at: now.toISOString(),
        finishes_at: new Date(now.getTime() + 60_000).toISOString(),
        duration: 60,
        source: "external",
        schedule_id: null,
        last_run: null,
        history: [],
      },
    };
    const card = await mountCard(
      {
        "sensor.jardim_next_run": baseSensor(),
        "binary_sensor.jardim_watering": watering,
      },
      [],
    );

    const timer = card.shadowRoot?.querySelector(".water-now-timer");
    expect(timer?.textContent).toContain("restantes");
    expect(timer?.textContent).toContain("ativada no dispositivo");
  });

  it("renders the last-run row from last_run, clickable to open the history dialog", async () => {
    const lastRun = historyRun({
      started_at: "2026-08-13T06:00:00Z",
      duration: 600,
      source: "schedule",
      flow_rate_lph: 8,
      number_of_pots: 12,
    });
    const card = await mountCard(
      {
        "sensor.jardim_next_run": baseSensor(),
        "binary_sensor.jardim_watering": baseBinarySensor({
          last_run: lastRun,
          history: [lastRun],
        }),
      },
      [],
    );

    const row = card.shadowRoot?.querySelector(".last-run");
    expect(row).not.toBeNull();
    // The exact HH:MM depends on the test runner's local timezone (the
    // source ISO is UTC); only the tz-independent parts are asserted here.
    expect(row?.textContent).toContain("Hoje");
    expect(row?.textContent).toContain("agendada");
    expect(row?.textContent).toContain("10 min");

    // Verified via internal state rather than DOM presence: happy-dom does
    // not reliably commit Lit's diff for a root-level (outside <ha-card>)
    // overlay toggle in this test harness -- the SAME gap already existed,
    // untested, for the pre-existing add/edit schedule dialog (_dialogOpen).
    // It renders correctly in a real browser (confirmed by the pH/EC/history
    // mockups this feature's design was approved from); this only asserts
    // the click wiring and state transition, which is what this test owns.
    expect((card as unknown as { _historyOpen: boolean })._historyOpen).toBe(false);
    (row as HTMLElement).click();
    expect((card as unknown as { _historyOpen: boolean })._historyOpen).toBe(true);
  });

  it("closes via _closeHistory (Fechar button / overlay click wiring)", async () => {
    const lastRun = historyRun();
    const card = await mountCard(
      {
        "sensor.jardim_next_run": baseSensor(),
        "binary_sensor.jardim_watering": baseBinarySensor({
          last_run: lastRun,
          history: [lastRun],
        }),
      },
      [],
    );
    const withState = card as unknown as {
      _historyOpen: boolean;
      _closeHistory: () => void;
    };
    (card.shadowRoot?.querySelector(".last-run") as HTMLElement).click();
    expect(withState._historyOpen).toBe(true);
    withState._closeHistory();
    expect(withState._historyOpen).toBe(false);
  });

  it("_lastRunText formats day/source/duration/volume for the row", () => {
    const card = makeCard();
    const text = (
      card as unknown as {
        _lastRunText: (run: HistoryRun, nowIso: string) => string;
      }
    )._lastRunText(
      historyRun({
        started_at: "2026-08-13T06:00:00Z",
        duration: 600,
        source: "manual",
        flow_rate_lph: 8,
        number_of_pots: 12,
      }),
      "2026-08-13T09:00:00Z",
    );
    expect(text).toContain("Hoje");
    expect(text).toContain("manual");
    expect(text).toContain("10 min");
    expect(text).toContain("1.33 L/vaso");
  });

  it("shows the accumulated daily volume per pot in the day total", () => {
    const card = makeCard();
    const group: HistoryDayGroup = {
      label: "Hoje",
      entries: [historyRun(), historyRun()],
      totalMl: 270_000,
      perPotMl: 1_200,
    };
    const template = (
      card as unknown as {
        _renderHistoryDayGroup: (value: HistoryDayGroup) => unknown;
      }
    )._renderHistoryDayGroup(group);
    const container = document.createElement("div");
    render(template as Parameters<typeof render>[0], container);

    const total = container.querySelector(".history-day-total")?.textContent ?? "";
    expect(total).toContain("2 regas");
    expect(total).toContain("270 L");
    expect(total).toContain("1.2 L/vaso");
  });
});

describe("IrrigationScheduleCard schedule status icons (done/pending/warning)", () => {
  beforeEach(() => {
    // 2026-08-13T09:00:00Z is a Thursday -- baseSensor's s1 (06:00, every
    // day) has already fired today; s2 (18:00, every day) has not yet.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-08-13T09:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows a pending clock icon for a schedule not yet due today", async () => {
    const card = await mountCard(
      {
        "sensor.jardim_next_run": baseSensor(),
        "binary_sensor.jardim_watering": baseBinarySensor(),
      },
      [],
    );
    const rows = card.shadowRoot?.querySelectorAll(".schedule-row") ?? [];
    expect(rows).toHaveLength(2);
    // s1 (06:00, already passed, no history) -> ambiguous, no icon.
    expect(rows[0].querySelector(".status-icon")).toBeNull();
    // s2 (18:00, still ahead) -> pending.
    const pending = rows[1].querySelector(".status-pending");
    expect(pending).not.toBeNull();
    expect(pending?.getAttribute("title")).toBe("Ainda vai regar hoje");
  });

  it("shows a done checkmark when a matching history entry confirms it ran today", async () => {
    const ranToday = historyRun({
      schedule_id: "s1",
      started_at: "2026-08-13T06:00:05Z",
    });
    const card = await mountCard(
      {
        "sensor.jardim_next_run": baseSensor(),
        "binary_sensor.jardim_watering": baseBinarySensor({
          history: [ranToday],
        }),
      },
      [],
    );
    const rows = card.shadowRoot?.querySelectorAll(".schedule-row") ?? [];
    const done = rows[0].querySelector(".status-done");
    expect(done).not.toBeNull();
    expect(done?.getAttribute("title")).toBe("Rega de hoje concluída");
  });

  it("shows the warning icon instead of done/pending when schedule_warnings has an entry", async () => {
    const ranToday = historyRun({
      schedule_id: "s1",
      started_at: "2026-08-13T06:00:05Z",
    });
    const card = await mountCard(
      {
        "sensor.jardim_next_run": baseSensor({
          schedule_warnings: { s1: "Tomada não ligou (verifique energia/conexão)" },
        }),
        "binary_sensor.jardim_watering": baseBinarySensor({
          history: [ranToday],
        }),
      },
      [],
    );
    const rows = card.shadowRoot?.querySelectorAll(".schedule-row") ?? [];
    expect(rows[0].querySelector(".warning-icon")).not.toBeNull();
    expect(rows[0].querySelector(".status-done")).toBeNull();
    expect(rows[0].querySelector(".status-pending")).toBeNull();
  });
});

describe("IrrigationScheduleCard entity contract validation", () => {
  it("rejects a sensor.* entity that is not one of our next_run sensors", async () => {
    // The "sensor." prefix alone is not proof of ownership: any HA sensor
    // matches it. Strip the integration's own contract attributes to
    // simulate pointing the card at an unrelated sensor.
    const { switch_entity_id, binary_sensor_entity_id, ...rest } =
      baseSensor().attributes;
    const foreignSensor: HassEntity = {
      ...baseSensor(),
      attributes: rest,
    };
    const card = await mountCard(
      { "sensor.jardim_next_run": foreignSensor },
      [],
    );
    expect(card.shadowRoot?.querySelector(".config-error")?.textContent).toContain(
      "não é um sensor da integração irrigation_scheduler",
    );
  });

  it("still accepts our own next_run sensor", async () => {
    const card = await mountCard({ "sensor.jardim_next_run": baseSensor() }, []);
    expect(card.shadowRoot?.querySelector(".config-error")).toBeNull();
  });
});

describe("IrrigationScheduleCard backend error surfacing", () => {
  it("_saveDialog keeps the dialog open and shows the backend error on failure", async () => {
    const card = makeCard();
    card.hass = {
      language: "pt-BR",
      locale: { language: "pt-BR" },
      states: { "sensor.jardim_next_run": baseSensor() },
      callService: async () => {
        throw { message: "duration exceeds max_duration" };
      },
    };
    card.setConfig({ ...VALID_CONFIG });
    document.body.appendChild(card);
    attachedCards.push(card);
    await card.updateComplete;

    const withState = card as unknown as {
      _openAdd: () => void;
      _formDays: number[];
      _formDurationMin: number;
      _saveDialog: () => void;
      _dialogOpen: boolean;
      _formError: string | null;
    };
    withState._openAdd();
    withState._formDays = [1];
    withState._formDurationMin = 5;
    withState._saveDialog();
    expect(withState._dialogOpen).toBe(true); // not closed yet: call is pending
    await Promise.resolve();
    await Promise.resolve();
    expect(withState._dialogOpen).toBe(true); // failure keeps it open
    expect(withState._formError).toBe("duration exceeds max_duration");
  });

  it("_saveDialog closes the dialog on a successful save", async () => {
    const calls: ServiceCallRecord[] = [];
    const card = await mountCard({ "sensor.jardim_next_run": baseSensor() }, calls);

    const withState = card as unknown as {
      _openAdd: () => void;
      _formDays: number[];
      _formDurationMin: number;
      _saveDialog: () => void;
      _dialogOpen: boolean;
      _formError: string | null;
    };
    withState._openAdd();
    withState._formDays = [1];
    withState._formDurationMin = 5;
    withState._saveDialog();
    await Promise.resolve();
    await Promise.resolve();
    expect(withState._dialogOpen).toBe(false);
    expect(withState._formError).toBeNull();
    expect(calls).toHaveLength(1);
  });

  it("_saveSettings keeps the panel open and shows the backend error on failure", async () => {
    const card = makeCard();
    card.hass = {
      language: "pt-BR",
      locale: { language: "pt-BR" },
      states: { "sensor.jardim_next_run": baseSensor() },
      callService: async () => {
        throw { message: "pH inválido" };
      },
    };
    card.setConfig({ ...VALID_CONFIG });
    document.body.appendChild(card);
    attachedCards.push(card);
    await card.updateComplete;

    const withState = card as unknown as {
      _settingsOpen: boolean;
      _settingsFlow: string;
      _saveSettings: () => void;
      _settingsError: string | null;
    };
    withState._settingsOpen = true;
    withState._settingsFlow = "10";
    withState._saveSettings();
    await Promise.resolve();
    await Promise.resolve();
    expect(withState._settingsOpen).toBe(true); // failure keeps the panel open
    expect(withState._settingsError).toBe("pH inválido");
  });
});

describe("IrrigationScheduleCard schedule duration hh:mm:ss / volume picker", () => {
  it("_openAdd always starts every field zeroed, regardless of the zone's default_duration", async () => {
    const card = await mountCard(
      { "sensor.jardim_next_run": baseSensor({ default_duration: 5400 }) }, // 1h30m
      [],
    );
    const withState = card as unknown as {
      _openAdd: () => void;
      _formTime: string;
      _formDays: number[];
      _formDurationHour: number;
      _formDurationMin: number;
      _formDurationSec: number;
    };
    withState._openAdd();
    expect(withState._formTime).toBe("00:00");
    expect(withState._formDays).toEqual([]);
    expect(withState._formDurationHour).toBe(0);
    expect(withState._formDurationMin).toBe(0);
    expect(withState._formDurationSec).toBe(0);
  });

  it("_openEdit splits an existing schedule's duration into hours/minutes/seconds", async () => {
    const card = await mountCard({ "sensor.jardim_next_run": baseSensor() }, []);
    const withState = card as unknown as {
      _openEdit: (schedule: {
        id: string;
        time: string;
        days: number[];
        duration: number;
        enabled: boolean;
      }) => void;
      _formDurationHour: number;
      _formDurationMin: number;
      _formDurationSec: number;
    };
    withState._openEdit({
      id: "s1",
      time: "06:00:00",
      days: [0],
      duration: 3661, // 1h 1m 1s
      enabled: true,
    });
    expect(withState._formDurationHour).toBe(1);
    expect(withState._formDurationMin).toBe(1);
    expect(withState._formDurationSec).toBe(1);
  });

  it("_saveDialog combines hours/minutes/seconds back into a single duration", async () => {
    const calls: ServiceCallRecord[] = [];
    const card = await mountCard({ "sensor.jardim_next_run": baseSensor() }, calls);
    const withState = card as unknown as {
      _openAdd: () => void;
      _formDays: number[];
      _formDurationHour: number;
      _formDurationMin: number;
      _formDurationSec: number;
      _saveDialog: () => void;
    };
    withState._openAdd();
    withState._formDays = [1];
    withState._formDurationHour = 1;
    withState._formDurationMin = 2;
    withState._formDurationSec = 3;
    withState._saveDialog();
    await Promise.resolve();
    await Promise.resolve();
    expect(calls).toHaveLength(1);
    expect(calls[0].data.duration).toBe(3723); // 1h2m3s
  });

  it("editing the volume field recalculates hours/minutes/seconds from the zone's flow rate", async () => {
    const card = await mountCard(
      { "sensor.jardim_next_run": baseSensor({ flow_rate_lph: 8 }) },
      [],
    );
    const withState = card as unknown as {
      _openAdd: () => void;
      _formDurationHour: number;
      _formDurationMin: number;
      _formDurationSec: number;
      _onVolumeChange: (ev: Event) => void;
    };
    withState._openAdd();
    const input = document.createElement("input");
    input.value = "2000"; // 2000 ml at 8 L/h per pot -> 900s (15 min)
    withState._onVolumeChange({ target: input } as unknown as Event);
    expect(withState._formDurationHour).toBe(0);
    expect(withState._formDurationMin).toBe(15);
    expect(withState._formDurationSec).toBe(0);
  });

  it("editing the volume field is a no-op when the zone has no flow rate configured", async () => {
    const card = await mountCard(
      { "sensor.jardim_next_run": baseSensor({ flow_rate_lph: 0 }) },
      [],
    );
    const withState = card as unknown as {
      _openAdd: () => void;
      _formDurationHour: number;
      _formDurationMin: number;
      _formDurationSec: number;
      _onVolumeChange: (ev: Event) => void;
    };
    withState._openAdd();
    const before = {
      h: withState._formDurationHour,
      m: withState._formDurationMin,
      s: withState._formDurationSec,
    };
    const input = document.createElement("input");
    input.value = "2000";
    withState._onVolumeChange({ target: input } as unknown as Event);
    expect(withState._formDurationHour).toBe(before.h);
    expect(withState._formDurationMin).toBe(before.m);
    expect(withState._formDurationSec).toBe(before.s);
  });
});

describe("IrrigationScheduleCard enable toggles", () => {
  /** A master schedule-enabled switch entity in the given state. */
  function masterSwitch(state: "on" | "off"): HassEntity {
    return {
      entity_id: "switch.jardim_schedule_enabled",
      state,
      last_changed: "",
      last_updated: "",
      attributes: { friendly_name: "Jardim agendamento" },
    };
  }

  function masterToggle(card: IrrigationScheduleCard): HTMLButtonElement {
    const el = card.shadowRoot?.querySelector<HTMLButtonElement>(
      ".header-right .toggle",
    );
    if (!el) {
      throw new Error("master toggle not rendered");
    }
    return el;
  }

  function scheduleToggles(card: IrrigationScheduleCard): HTMLButtonElement[] {
    return Array.from(
      card.shadowRoot?.querySelectorAll<HTMLButtonElement>(
        ".schedule-row .toggle",
      ) ?? [],
    );
  }

  it("turns the master switch OFF when it is currently on", async () => {
    const calls: ServiceCallRecord[] = [];
    const card = await mountCard(
      {
        "sensor.jardim_next_run": baseSensor(),
        "switch.jardim_schedule_enabled": masterSwitch("on"),
      },
      calls,
    );

    const toggle = masterToggle(card);
    expect(toggle.getAttribute("aria-checked")).toBe("true");
    expect(toggle.classList.contains("off")).toBe(false);

    toggle.click();

    expect(calls).toEqual([
      {
        domain: "switch",
        service: "turn_off",
        data: {},
        target: { entity_id: "switch.jardim_schedule_enabled" },
      },
    ]);
  });

  it("turns the master switch ON when it is currently off", async () => {
    const calls: ServiceCallRecord[] = [];
    const card = await mountCard(
      {
        "sensor.jardim_next_run": baseSensor(),
        "switch.jardim_schedule_enabled": masterSwitch("off"),
      },
      calls,
    );

    const toggle = masterToggle(card);
    expect(toggle.getAttribute("aria-checked")).toBe("false");
    expect(toggle.classList.contains("off")).toBe(true);

    toggle.click();

    expect(calls).toEqual([
      {
        domain: "switch",
        service: "turn_on",
        data: {},
        target: { entity_id: "switch.jardim_schedule_enabled" },
      },
    ]);
  });

  it("renders the master toggle disabled, named and inert without a switch entity", async () => {
    const calls: ServiceCallRecord[] = [];
    const card = await mountCard(
      { "sensor.jardim_next_run": baseSensor({ switch_entity_id: null }) },
      calls,
    );

    const toggle = masterToggle(card);
    expect(toggle.disabled).toBe(true);
    expect(toggle.getAttribute("aria-checked")).toBe("false");
    // A disabled switch still needs an accessible name -- otherwise a screen
    // reader announces only "switch, off" with no indication of what it is.
    expect(toggle.getAttribute("aria-label")).toBeTruthy();

    toggle.click();
    expect(calls).toEqual([]);
  });

  it("disables an enabled schedule and enables a disabled one", async () => {
    const calls: ServiceCallRecord[] = [];
    const sensor = baseSensor({
      schedules: [
        { id: "s1", time: "06:00:00", days: [0], duration: 600, enabled: true },
        { id: "s2", time: "18:00:00", days: [0], duration: 600, enabled: false },
      ],
    });
    const card = await mountCard({ "sensor.jardim_next_run": sensor }, calls);

    const [enabled, disabled] = scheduleToggles(card);
    expect(enabled.getAttribute("aria-checked")).toBe("true");
    expect(disabled.getAttribute("aria-checked")).toBe("false");

    enabled.click();
    disabled.click();

    expect(calls.map((c) => [c.service, c.data])).toEqual([
      ["update_schedule", { id: "s1", enabled: false }],
      ["update_schedule", { id: "s2", enabled: true }],
    ]);
    expect(calls.every((c) => c.domain === DOMAIN)).toBe(true);
  });

  it("names both toggles statically, leaving state to aria-checked", async () => {
    const sensor = baseSensor({
      schedules: [
        { id: "s1", time: "06:30:00", days: [0], duration: 600, enabled: true },
      ],
    });
    const card = await mountCard(
      {
        "sensor.jardim_next_run": sensor,
        "switch.jardim_schedule_enabled": masterSwitch("on"),
      },
      [],
    );

    // For role="switch" the accessible name must describe WHAT is controlled;
    // the on/off state is conveyed by aria-checked. A name that flips with the
    // state (or describes the action) contradicts the announced state.
    expect(masterToggle(card).getAttribute("aria-label")).toBe(
      "Agendamento automático",
    );
    expect(scheduleToggles(card)[0].getAttribute("aria-label")).toBe(
      "Horário das 06:30",
    );
  });

  it("gives every custom button an explicit type so none defaults to submit", async () => {
    const card = await mountCard(
      {
        "sensor.jardim_next_run": baseSensor(),
        "switch.jardim_schedule_enabled": masterSwitch("on"),
      },
      [],
    );

    const buttons = Array.from(
      card.shadowRoot?.querySelectorAll("button") ?? [],
    );
    expect(buttons.length).toBeGreaterThan(0);
    expect(
      buttons.filter((b) => b.getAttribute("type") !== "button"),
    ).toEqual([]);
  });
});

describe("IrrigationScheduleCard summary block", () => {
  function summary(card: IrrigationScheduleCard) {
    const root = card.shadowRoot;
    return {
      headline: root?.querySelector(".summary-main strong")?.textContent?.trim(),
      next: root
        ?.querySelector(".summary-main span")
        ?.textContent?.replace(/\s+/g, " ")
        .trim(),
      statLabel: root?.querySelector(".summary-stat span")?.textContent?.trim(),
      statValue: root
        ?.querySelector(".summary-stat strong")
        ?.textContent?.trim(),
    };
  }

  // The count is taken against the WALL CLOCK, not the sensor's state, so the
  // fixtures derive today's index instead of hardcoding a weekday -- otherwise
  // the suite would pass or fail depending on the day it runs.
  const today = (new Date().getDay() + 6) % 7;
  const otherDay = (today + 3) % 7;

  it("counts today's enabled schedules and shows the next run", async () => {
    const sensor = baseSensor({
      schedules: [
        { id: "a", time: "06:00:00", days: [today], duration: 600, enabled: true },
        { id: "b", time: "18:00:00", days: [today], duration: 600, enabled: true },
        { id: "c", time: "20:00:00", days: [otherDay], duration: 600, enabled: true },
        { id: "d", time: "22:00:00", days: [today], duration: 600, enabled: false },
      ],
    });
    const card = await mountCard({ "sensor.jardim_next_run": sensor }, []);

    // Only a + b: c is another weekday, d is disabled.
    expect(summary(card).headline).toBe("2 horários hoje");
    expect(summary(card).next).toContain("Próxima:");
  });

  it("uses the singular form for exactly one schedule", async () => {
    const sensor = baseSensor({
      schedules: [
        { id: "a", time: "06:00:00", days: [today], duration: 600, enabled: true },
      ],
    });
    const card = await mountCard({ "sensor.jardim_next_run": sensor }, []);
    expect(summary(card).headline).toBe("1 horário hoje");
  });

  it("shows the average daily volume when a flow rate is configured", async () => {
    const sensor = baseSensor({
      flow_rate_lph: 60,
      number_of_pots: 1,
      schedules: [
        {
          id: "a",
          time: "06:00:00",
          days: [0, 1, 2, 3, 4, 5, 6],
          duration: 3600,
          enabled: true,
        },
      ],
    });
    const card = await mountCard({ "sensor.jardim_next_run": sensor }, []);
    // 60 L/h * 1 h * 1 pot, every day -> 60 L/day.
    expect(summary(card).statLabel).toBe("Volume/dia");
    expect(summary(card).statValue).toBe("60 L");
  });

  it("hides the volume stat entirely when no flow rate is configured", async () => {
    const card = await mountCard({ "sensor.jardim_next_run": baseSensor() }, []);
    expect(card.shadowRoot?.querySelector(".summary-stat")).toBeNull();
  });

  it("says the schedule is off instead of counting runs that cannot happen", async () => {
    // With the master switch off the backend stops publishing a next run, so
    // counting today's schedules beside "Nenhum horario agendado" read as a
    // contradiction.
    const sensor = baseSensor({
      schedules: [
        { id: "a", time: "06:00:00", days: [today], duration: 600, enabled: true },
        { id: "b", time: "18:00:00", days: [today], duration: 600, enabled: true },
      ],
    });
    const card = await mountCard(
      {
        "sensor.jardim_next_run": sensor,
        "switch.jardim_schedule_enabled": {
          entity_id: "switch.jardim_schedule_enabled",
          state: "off",
          last_changed: "",
          last_updated: "",
          attributes: {},
        },
      },
      [],
    );

    expect(summary(card).headline).toBe("Agendamento desativado");
    // The "Proxima:" line goes with it rather than reading "Nenhum ...".
    expect(card.shadowRoot?.querySelector(".summary-main span")).toBeNull();
  });

  it("does NOT claim the schedule is off when the switch entity is missing", async () => {
    // Absent/unavailable is UNKNOWN, not off: asserting "desativado" there
    // would be a claim the card cannot support.
    const sensor = baseSensor({
      schedules: [
        { id: "a", time: "06:00:00", days: [today], duration: 600, enabled: true },
      ],
    });
    const missing = await mountCard({ "sensor.jardim_next_run": sensor }, []);
    expect(summary(missing).headline).toBe("1 horário hoje");

    const unavailable = await mountCard(
      {
        "sensor.jardim_next_run": sensor,
        "switch.jardim_schedule_enabled": {
          entity_id: "switch.jardim_schedule_enabled",
          state: "unavailable",
          last_changed: "",
          last_updated: "",
          attributes: {},
        },
      },
      [],
    );
    expect(summary(unavailable).headline).toBe("1 horário hoje");
  });

  it("drops the pending icon while the master switch is off", async () => {
    // A schedule due later today would otherwise still promise "ainda vai
    // regar hoje" with the whole automation disabled.
    const sensor = baseSensor({
      schedules: [
        { id: "a", time: "23:59:00", days: [today], duration: 600, enabled: true },
      ],
    });
    const off = {
      entity_id: "switch.jardim_schedule_enabled",
      state: "off",
      last_changed: "",
      last_updated: "",
      attributes: {},
    };
    const card = await mountCard(
      { "sensor.jardim_next_run": sensor, "switch.jardim_schedule_enabled": off },
      [],
    );
    expect(card.shadowRoot?.querySelector(".status-pending")).toBeNull();

    const on = await mountCard(
      {
        "sensor.jardim_next_run": sensor,
        "switch.jardim_schedule_enabled": { ...off, state: "on" },
      },
      [],
    );
    expect(on.shadowRoot?.querySelector(".status-pending")).not.toBeNull();
  });
});
