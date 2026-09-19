import { config } from "@remotion/eslint-config-flat";

export default [
  ...(Array.isArray(config) ? config : [config]),
  {
    // Node scripts, not browser code: give them the Node globals.
    files: ["scripts/**/*.mjs"],
    languageOptions: {
      globals: {
        process: "readonly",
        console: "readonly",
        Buffer: "readonly",
      },
    },
  },
];
