import { afterEach, describe, expect, it } from "vitest";

import { IrrigationScheduleCardEditor } from "../src/editor";
import type { HomeAssistant } from "../src/types";

function makeEditor(): IrrigationScheduleCardEditor {
  if (!customElements.get("irrigation-schedule-card-editor")) {
    customElements.define(
      "irrigation-schedule-card-editor",
      IrrigationScheduleCardEditor,
    );
  }
  return document.createElement(
    "irrigation-schedule-card-editor",
  ) as IrrigationScheduleCardEditor;
}

const attached: IrrigationScheduleCardEditor[] = [];

afterEach(() => {
  for (const el of attached.splice(0)) {
    el.remove();
  }
});

describe("IrrigationScheduleCardEditor", () => {
  it("REGRESSION: implements setConfig (the Lovelace editor host calls this, not a `.config` property assignment)", () => {
    const editor = makeEditor();
    expect(typeof editor.setConfig).toBe("function");
    expect(() =>
      editor.setConfig({
        type: "custom:irrigation-schedule-card",
        entity: "sensor.jardim_next_run",
      }),
    ).not.toThrow();
  });

  it("renders an ha-form once hass and config are both present", async () => {
    const editor = makeEditor();
    document.body.appendChild(editor);
    attached.push(editor);

    editor.setConfig({
      type: "custom:irrigation-schedule-card",
      entity: "sensor.jardim_next_run",
    });
    editor.hass = {
      language: "pt-BR",
      states: {},
      callService: async () => {},
    } as HomeAssistant;
    await editor.updateComplete;

    expect(editor.shadowRoot?.querySelector("ha-form")).not.toBeNull();
  });

  it("renders nothing until both hass and config are set", async () => {
    const editor = makeEditor();
    document.body.appendChild(editor);
    attached.push(editor);
    await editor.updateComplete;

    expect(editor.shadowRoot?.querySelector("ha-form")).toBeNull();
  });
});
