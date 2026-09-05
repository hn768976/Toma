import { config } from "@remotion/eslint-config-flat";

export default [
  ...(Array.isArray(config) ? config : [config]),
  {
    // Build tooling: plain Node scripts, not part of the Remotion bundle.
    files: ["scripts/**/*.mjs"],
    languageOptions: { globals: { console: "readonly", process: "readonly" } },
  },
];
