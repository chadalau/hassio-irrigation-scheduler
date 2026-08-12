import typescript from "@rollup/plugin-typescript";
import terser from "@rollup/plugin-terser";
import nodeResolve from "@rollup/plugin-node-resolve";

// Home Assistant has NO import map: custom card files are loaded as plain
// ES modules, so bare specifier imports ("lit", "home-assistant") cannot
// resolve at runtime. Everything (lit included) is therefore bundled into a
// self-contained IIFE. Data comes from the `hass` object injected by
// Lovelace (rebuilt on every entity change) and from the global ha-* custom
// elements in the HA frontend.
export default {
  input: "src/card.ts",
  plugins: [
    nodeResolve(),
    typescript({
      tsconfig: "./tsconfig.json",
      include: ["src/**/*.ts"],
      exclude: ["tests/**/*"],
      declaration: false,
    }),
    terser({
      format: { comments: false },
    }),
  ],
  output: {
    file: "../custom_components/irrigation_scheduler/frontend/irrigation-schedule-card.js",
    format: "iife",
    name: "IrrigationScheduleCard",
  },
};
