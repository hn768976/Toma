import { config } from "@remotion/eslint-config-flat";

export default [
  ...(Array.isArray(config) ? config : [config]),
  {
    // The scripts in scripts/ are Node programs, not browser code.
    files: ["scripts/**/*.mjs"],
    languageOptions: {
      globals: { console: "readonly", process: "readonly" },
    },
  },
];
