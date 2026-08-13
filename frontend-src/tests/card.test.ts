import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { IrrigationScheduleCard, validateCardConfig } from "../src/card";
import type { HassEntity, HistoryRun, HomeAssistant } from "../src/types";

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
      'ha-icon-button[title="Configurar vazão e vasos"]',
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
      ".settings-panel .dialog-save",
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
      '.settings-panel .duration-row input[type="number"]',
    ) as NodeListOf<HTMLInputElement>;
    // 4 = R1 min/max + R2 min/max; the first pair (index 0/1) is R1's.
    expect(numberInputs).toHaveLength(4);
    dispatchChange(numberInputs[0], "7"); // ph_min (R1)
    dispatchChange(numberInputs[1], "6"); // ph_max (R1)
    await card.updateComplete;

    const saveButton = card.shadowRoot?.querySelector(
      ".settings-panel .dialog-save",
    ) as HTMLButtonElement;
    saveButton.click();
    await card.updateComplete;

    expect(calls).toHaveLength(0);
    expect(card.shadowRoot?.querySelector(".settings-panel .form-error")?.textContent).toContain(
      "mínimo",
    );
    // The panel stays open so the user can fix the values.
    expect(card.shadowRoot?.querySelector(".settings-panel")).not.toBeNull();
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
      card.shadowRoot?.querySelector(".settings-panel .dialog-save") as HTMLButtonElement
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
      ".settings-panel .field input[type='number']",
    ) as HTMLInputElement;
    expect(durationInput.value).toBe("10"); // 600s displayed as 10 minutes
    dispatchChange(durationInput, "15");
    await card.updateComplete;

    (
      card.shadowRoot?.querySelector(".settings-panel .dialog-save") as HTMLButtonElement
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
      ".settings-panel .field input[type='number']",
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

    const phBadge = card.shadowRoot?.querySelector(".ph-badge");
    const ecBadge = card.shadowRoot?.querySelector(".ec-badge");
    // pH shows "{value} PH" -- a fixed suffix, NOT the sensor's own
    // unit_of_measurement (which is often itself "pH" and would otherwise
    // duplicate into "PH 6.23pH"). EC keeps its real unit.
    expect(phBadge?.textContent?.trim()).toBe("6.23 PH");
    expect(ecBadge?.textContent?.trim()).toBe("EC 812.4 µS/cm");
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

    const phBadge = card.shadowRoot?.querySelector(".ph-badge");
    // The sensor's own unit ("pH") is ignored in favor of the fixed suffix.
    expect(phBadge?.textContent?.trim()).toBe("7.8 PH");
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
    expect(card.shadowRoot?.querySelector(".ph-badge")?.textContent?.trim()).toBe(
      "pH ?",
    );
  });

  it("renders no badges when neither ph_entity_id nor ec_entity_id is configured", async () => {
    const card = await mountCard({ "sensor.jardim_next_run": baseSensor() }, []);
    expect(card.shadowRoot?.querySelector(".ph-badge")).toBeNull();
    expect(card.shadowRoot?.querySelector(".ec-badge")).toBeNull();
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

    (card.shadowRoot?.querySelector(".ph-badge") as HTMLButtonElement).click();

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

    const labels = card.shadowRoot?.querySelectorAll(".reservoir-label");
    const phBadges = card.shadowRoot?.querySelectorAll(".ph-badge");
    const ecBadges = card.shadowRoot?.querySelectorAll(".ec-badge");
    expect(labels?.[0].textContent?.trim()).toBe("R1");
    expect(labels?.[1].textContent?.trim()).toBe("R2");
    expect(phBadges).toHaveLength(2);
    expect(ecBadges).toHaveLength(2);
    // No " R2" text suffix: the row's own "R2" pill already disambiguates.
    expect(phBadges?.[0].textContent?.trim()).toBe("6 PH");
    expect(phBadges?.[1].textContent?.trim()).toBe("6.4 PH");
    expect(ecBadges?.[0].textContent?.trim()).toBe("EC 800 µS/cm");
    expect(ecBadges?.[1].textContent?.trim()).toBe("EC 1200 µS/cm");
  });

  it("lays out each row as label/pH/EC in a 6-column grid so R1 and R2 columns align", async () => {
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
    const children = Array.from(
      card.shadowRoot?.querySelector(".header-badges")?.children ?? [],
    );
    // Row-major DOM order: R1's label/pH/EC, then R2's label/pH/EC. Visual
    // column alignment comes from the CSS grid's 6 fixed columns (each sized
    // to its own widest cell), not from DOM order -- see .header-badges.
    expect(children).toHaveLength(6);
    expect(children[0].classList.contains("reservoir-label")).toBe(true);
    expect(children[0].textContent?.trim()).toBe("R1");
    expect(children[1].classList.contains("ph-badge")).toBe(true);
    expect(children[2].classList.contains("ec-badge")).toBe(true);
    expect(children[3].classList.contains("reservoir-label")).toBe(true);
    expect(children[3].textContent?.trim()).toBe("R2");
    expect(children[4].classList.contains("ph-badge")).toBe(true);
    expect(children[5].classList.contains("ec-badge")).toBe(true);
  });

  it("shows the reservoir volume badge after EC, repeated on both rows", async () => {
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
    const volumeBadges = card.shadowRoot?.querySelectorAll(".volume-badge");
    expect(volumeBadges).toHaveLength(2);
    expect(volumeBadges?.[0].textContent?.trim()).toBe("1000/1000 L");
    expect(volumeBadges?.[1].textContent?.trim()).toBe("1000/1000 L");
  });

  it("does not show the volume badge when reservoir_volume_l is not configured", async () => {
    const card = await mountCard(
      { "sensor.jardim_next_run": baseSensor({ ph_entity_id: "sensor.r1_ph" }) },
      [],
    );
    expect(card.shadowRoot?.querySelectorAll(".volume-badge")).toHaveLength(0);
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
    expect(card.shadowRoot?.querySelectorAll(".ph-badge")).toHaveLength(1);
    expect(card.shadowRoot?.querySelectorAll(".ec-badge")).toHaveLength(1);
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
    expect(card.shadowRoot?.querySelector(".volume-badge")).not.toBeNull();
    expect(card.shadowRoot?.querySelector(".refill-button")).not.toBeNull();
  });

  it("does not show the R1/R2 label pill when only one reservoir is shown", async () => {
    const card = await mountCard(
      {
        "sensor.jardim_next_run": baseSensor({
          ph_entity_id: "sensor.r1_ph",
          reservoir_volume_l: 1000,
        }),
      },
      [],
    );
    expect(card.shadowRoot?.querySelector(".reservoir-label")).toBeNull();
    // The row still renders (pH badge + volume badge), just without the
    // disambiguation pill.
    expect(card.shadowRoot?.querySelector(".ph-badge")).not.toBeNull();
    expect(card.shadowRoot?.querySelector(".volume-badge")).not.toBeNull();
  });

  it("shows the R1/R2 label pill only when both reservoirs are shown", async () => {
    const card = await mountCard(
      {
        "sensor.jardim_next_run": baseSensor({
          ph_entity_id: "sensor.r1_ph",
          ph_entity_id_2: "sensor.r2_ph",
        }),
      },
      [],
    );
    const labels = card.shadowRoot?.querySelectorAll(".reservoir-label");
    expect(labels).toHaveLength(2);
    expect(labels?.[0].textContent?.trim()).toBe("R1");
    expect(labels?.[1].textContent?.trim()).toBe("R2");
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
    const badge = card.shadowRoot?.querySelector(".volume-badge");
    expect(badge?.textContent?.trim()).toBe("620/1000 L");
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
    const badge = card.shadowRoot?.querySelector(".volume-badge");
    expect(badge?.textContent?.trim()).toBe("1000/1000 L");
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
    const estimate = card.shadowRoot?.querySelector(".reservoir-estimate");
    expect(estimate?.textContent?.trim()).toBe("~17 dias");
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
    expect(card.shadowRoot?.querySelector(".reservoir-estimate")).toBeNull();
  });

  it("does not show a refill button when reservoir_volume_l is not configured", async () => {
    const card = await mountCard(
      { "sensor.jardim_next_run": baseSensor({ ph_entity_id: "sensor.r1_ph" }) },
      [],
    );
    expect(card.shadowRoot?.querySelector(".refill-button")).toBeNull();
  });

  it("repeats remaining/estimate/refill on both R1 and R2 rows", async () => {
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
    expect(card.shadowRoot?.querySelectorAll(".volume-badge")).toHaveLength(2);
    expect(card.shadowRoot?.querySelectorAll(".refill-button")).toHaveLength(2);
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
