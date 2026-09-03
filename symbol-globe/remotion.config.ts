/**
 * Remotion configuration.
 * See https://remotion.dev/docs/config for all options.
 */
import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

Config.setRspack(true);
Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
// 4K canvases are memory-hungry; give each renderer tab room to breathe.
Config.setChromiumOpenGlRenderer("angle");

// Some sandboxed dev environments block downloading Remotion's own Chrome
// Headless Shell but ship a Playwright Chromium at this path. Reuse it there;
// on a normal machine the path won't exist and Remotion falls back to its
// own managed browser download.
const playwrightHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
}
