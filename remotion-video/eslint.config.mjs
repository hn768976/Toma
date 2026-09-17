import { config } from "@remotion/eslint-config-flat";

export default [
  ...config,
  {
    // The files under scripts/ are Node programs run by npm scripts rather than
    // browser code, so they need Node's globals.
    files: ["scripts/**/*.mjs"],
    languageOptions: {
      globals: { console: "readonly", process: "readonly" },
    },
  },
];
