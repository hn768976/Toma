/**
 * Note: When using the Node.JS APIs, the config file
 * doesn't apply. Instead, pass options directly to the APIs.
 *
 * All configuration options: https://remotion.dev/docs/config
 */

import { existsSync } from "node:fs";
import path from "node:path";
import { Config } from "@remotion/cli/config";
import { enableTailwind } from '@remotion/tailwind-v4';

Config.setRspack(true);
Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
Config.overrideBundlerConfig(enableTailwind);

// `@lib` resolves to the shared remotion-lib source. Standalone/vendored
// copies of a project point this same alias at their own ./src/lib, so no
// import statement has to change when a project is packaged up.
// NOTE: `__dirname` inside a Remotion config resolves to @remotion/cli's own
// directory, not the project — always anchor project-relative paths on
// process.cwd(), which is where the `remotion` CLI was invoked.
const LIB_SRC = path.resolve(process.cwd(), "../remotion-lib/src");
const VENDORED_LIB_SRC = path.resolve(process.cwd(), "src/lib");

Config.overrideBundlerConfig((config) => ({
  ...config,
  resolve: {
    ...config.resolve,
    alias: {
      ...config.resolve?.alias,
      "@lib": existsSync(VENDORED_LIB_SRC) ? VENDORED_LIB_SRC : LIB_SRC,
    },
  },
}));

// Some sandboxed dev environments block downloading Remotion's own
// Chrome Headless Shell but ship a Playwright Chromium at this path.
// Reuse it there instead of downloading; on a normal machine this path
// won't exist and Remotion falls back to its default managed browser.
const playwrightHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
}
