import { afterEach, describe, expect, it } from "vitest";

import { IrrigationScheduleCard, validateCardConfig } from "../src/card";
import type { HassEntity, HomeAssistant } from "../src/types";

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
      schedule_warnings: {},
      switch_entity_id: "switch.jardim_schedule_enabled",
      binary_sensor_entity_id: "binary_sensor.jardim_watering",
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
    expect(numberInputs).toHaveLength(2);
    dispatchChange(numberInputs[0], "7"); // ph_min
    dispatchChange(numberInputs[1], "6"); // ph_max
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
});
