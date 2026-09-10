/**
 * Remotion CLI config for the stills template.
 * Note: this file only applies to the CLI (`npx remotion still`, `npx remotion
 * studio`). scripts/render-stills.mjs passes the same options to the Node APIs.
 */
import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

Config.setRspack(true);
Config.setStillImageFormat("png");
Config.setOverwriteOutput(true);
// Large 6000x3375 stills: give Chrome plenty of time per frame.
Config.setDelayRenderTimeoutInMilliseconds(120000);

// Some sandboxed dev environments block downloading Remotion's own
// Chrome Headless Shell but ship a Playwright Chromium at this path.
// Reuse it there instead of downloading; on a normal machine this path
// won't exist and Remotion falls back to its default managed browser.
const playwrightHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
}
