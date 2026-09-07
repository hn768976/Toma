/**
 * Note: when using the Node APIs (scripts/render-batch.ts) this file does not
 * apply — those options are passed to the APIs directly.
 */
import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

Config.setRspack(true);
Config.setStillImageFormat("png");
Config.setOverwriteOutput(true);
// The field is drawn to a canvas in one synchronous pass; a 4K frame with
// ~1400 elements and six full-frame blurs needs more than the default.
Config.setDelayRenderTimeoutInMilliseconds(180000);
Config.setChromiumOpenGlRenderer("angle");

// Some sandboxed environments block Remotion's own Chrome Headless Shell
// download but ship a Playwright Chromium. Reuse it there; on a normal
// machine this path won't exist and Remotion falls back to its own browser.
const playwrightHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
}
