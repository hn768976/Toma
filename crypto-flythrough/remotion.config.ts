/**
 * Note: When using the Node.JS APIs, the config file doesn't apply.
 * Instead, pass options directly to the APIs.
 *
 * All configuration options: https://remotion.dev/docs/config
 */

import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
// 3D scenes need more memory per worker than 2D ones.
Config.setConcurrency(4);
// Generating the shared code textures and warming up WebGL takes longer than
// the 30s default when several workers boot at once.
Config.setDelayRenderTimeoutInMilliseconds(180000);
// The WebGL scene must survive a full 4K frame; give Chrome room to work.
Config.setChromiumDisableWebSecurity(false);

// Some sandboxed dev environments block downloading Remotion's own
// Chrome Headless Shell but ship a Playwright Chromium at this path.
// Reuse it there instead of downloading; on a normal machine this path
// won't exist and Remotion falls back to its default managed browser.
const playwrightHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
}
