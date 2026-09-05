import { config } from "@remotion/eslint-config-flat";
import globals from "globals";

export default [
  ...(Array.isArray(config) ? config : [config]),
  {
    // Build/verification scripts run under Node, not in the browser.
    files: ["scripts/**/*.mjs"],
    languageOptions: { globals: globals.node },
  },
];
