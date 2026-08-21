// One-off runtime smoke test for the built bundle (not part of the suite).
import { Window } from "happy-dom";
import { readFileSync } from "node:fs";

const window = new Window();
globalThis.window = window;
globalThis.document = window.document;
globalThis.customElements = window.customElements;
globalThis.HTMLElement = window.HTMLElement;
globalThis.CSSStyleSheet = window.CSSStyleSheet;
globalThis.Document = window.Document;
globalThis.ShadowRoot = window.ShadowRoot;
globalThis.Element = window.Element;
globalThis.Node = window.Node;
globalThis.Text = window.Text;
globalThis.Comment = window.Comment;
globalThis.CustomEvent = window.CustomEvent;
globalThis.MutationObserver = window.MutationObserver;

const code = readFileSync(
  new URL("../custom_components/irrigation_scheduler/frontend/irrigation-schedule-card.js", import.meta.url),
  "utf8",
);
eval(code);

const cardTag = window.customElements.get("irrigation-schedule-card");
const editorTag = window.customElements.get("irrigation-schedule-card-editor");
console.log("card registered:", cardTag ? cardTag.name : "MISSING");
console.log("editor registered:", editorTag ? editorTag.name : "MISSING");
if (!cardTag || !editorTag) throw new Error("elements not registered");

// --- Functional render check -------------------------------------------------
const card = document.createElement("irrigation-schedule-card");
card.setConfig({ type: "custom:irrigation-schedule-card", entity: "sensor.jardim_next_run" });
document.body.appendChild(card);

const state = (entity_id, entity_state, attributes) => ({ entity_id, state: entity_state, last_changed: "", last_updated: "", attributes });
card.hass = {
  language: "pt-BR",
  locale: { language: "pt-BR" },
  states: {
    "sensor.jardim_next_run": state("sensor.jardim_next_run", "2026-08-12T06:00:00+00:00", {
      friendly_name: "Jardim Próxima execução",
      schedules: [{ id: "aaaa1111", time: "06:00:00", days: [0, 2], duration: 900, enabled: true }],
      default_duration: 600,
      max_duration: 7200,
      switch_entity_id: "switch.jardim_schedule_enabled",
      binary_sensor_entity_id: "binary_sensor.jardim_watering",
    }),
    "switch.jardim_schedule_enabled": state("switch.jardim_schedule_enabled", "on", {}),
    "binary_sensor.jardim_watering": state("binary_sensor.jardim_watering", "off", {}),
  },
  callService: async () => {},
};

await card.updateComplete;
const root = card.shadowRoot;
const text = root.textContent;
console.log("zone name present:", text.includes("Jardim"));
console.log("status Agendada:", text.includes("Agendada"));
console.log("schedule time 06:00:", text.includes("06:00"));
const dayChips = [...root.querySelectorAll(".day-initial.active")].map((item) => item.textContent.trim());
console.log("day chips (S/Q):", dayChips.includes("S") && dayChips.includes("Q"));
console.log("duration 15 min:", text.includes("15 min"));
console.log("next run present:", text.includes("Próxima"));

if (!text.includes("Jardim") || !text.includes("06:00") || !text.includes("15 min") || !dayChips.includes("S") || !dayChips.includes("Q")) {
  throw new Error("card did not render expected content");
}

// --- Watering scenario -------------------------------------------------------
const finish = new Date(Date.now() + 5 * 60 * 1000).toISOString();
const started = new Date(Date.now() - 60 * 1000).toISOString();
card.hass = {
  language: "pt-BR",
  locale: { language: "pt-BR" },
  states: {
    "sensor.jardim_next_run": state("sensor.jardim_next_run", "unknown", {
      friendly_name: "Jardim Próxima execução",
      schedules: [],
      default_duration: 600,
      max_duration: 7200,
      switch_entity_id: "switch.jardim_schedule_enabled",
      binary_sensor_entity_id: "binary_sensor.jardim_watering",
    }),
    "switch.jardim_schedule_enabled": state("switch.jardim_schedule_enabled", "on", {}),
    "binary_sensor.jardim_watering": state("binary_sensor.jardim_watering", "on", {
      started_at: started,
      finishes_at: finish,
      duration: 360,
      source: "manual",
      schedule_id: null,
    }),
  },
  callService: async () => {},
};
await card.updateComplete;
const wateringText = card.shadowRoot.textContent;
console.log("watering timer restantes:", wateringText.includes("restantes"));
console.log("stop button Parar:", wateringText.includes("Parar"));
console.log("countdown MM:SS:", /[0-5]\d:[0-5]\d/.test(wateringText));

// --- Config error scenario ---------------------------------------------------
const bad = document.createElement("irrigation-schedule-card");
bad.setConfig({ type: "custom:irrigation-schedule-card", entity: "sensor.nao_existe" });
bad.hass = card.hass;
document.body.appendChild(bad);
await bad.updateComplete;
console.log("config error message:", bad.shadowRoot.textContent.includes("não encontrada"));

if (!wateringText.includes("restantes") || !wateringText.includes("Parar")) {
  throw new Error("watering UI did not render");
}
if (!bad.shadowRoot.textContent.includes("não encontrada")) {
  throw new Error("config error UI did not render");
}
card.remove();
bad.remove();
console.log("SMOKE OK");
process.exit(0);
