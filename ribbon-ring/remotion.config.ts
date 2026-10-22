/**
 * Note: When using the Node.JS APIs, the config file
 * doesn't apply. Instead, pass options directly to the APIs.
 *
 * All configuration options: https://remotion.dev/docs/config
 */

import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";
import { enableTailwind } from '@remotion/tailwind-v4';

Config.setRspack(true);
Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
Config.setDefaultPremountInSeconds(2);
Config.overrideBundlerConfig(enableTailwind);

// WebGL in headless Chrome: ANGLE (uses the GPU when present, falls
// back to SwiftShader otherwise).
Config.setChromiumOpenGlRenderer("angle");

// Sandboxed environments here block downloading Remotion's Chrome
// Headless Shell but ship a Playwright one; reuse it when present.
const playwrightHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
}
