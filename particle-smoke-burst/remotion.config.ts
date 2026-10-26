/**
 * Note: When using the Node.JS APIs, the config file
 * doesn't apply. Instead, pass options directly to the APIs.
 *
 * All configuration options: https://remotion.dev/docs/config
 */

import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

Config.setRspack(true);
Config.setVideoImageFormat("jpeg");
Config.setJpegQuality(95);
Config.setOverwriteOutput(true);
Config.setDefaultPremountInSeconds(2);
// The composition draws with WebGL 2. "swangle" (SwiftShader via ANGLE)
// works on any machine, including headless servers without a GPU.
// On a workstation with a GPU you can pass --gl=angle for faster renders.
Config.setChromiumOpenGlRenderer("swangle");

// Sandboxed environments that block downloading Remotion's Chrome Headless
// Shell often ship a Playwright one. Use it when present; otherwise Remotion
// downloads and uses its own managed browser.
const playwrightHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell";
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
}
