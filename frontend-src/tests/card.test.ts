import { describe, expect, it } from "vitest";

import { IrrigationScheduleCard, validateCardConfig } from "../src/card";

const VALID_CONFIG = {
  type: "custom:irrigation-schedule-card",
  entity: "sensor.jardim_next_run",
};

function makeCard(): IrrigationScheduleCard {
  return document.createElement(
    "irrigation-schedule-card",
  ) as IrrigationScheduleCard;
}

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
