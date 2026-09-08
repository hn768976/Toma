/**
 * Note: when using the Node.js APIs this config does not apply; pass options
 * directly to the APIs instead.
 * All options: https://remotion.dev/docs/config
 */
import {existsSync} from "node:fs";
import {Config} from "@remotion/cli/config";

Config.setOverwriteOutput(true);
Config.setStillImageFormat("png");
// The dot field is a heavy one-shot paint; give it room.
Config.setDelayRenderTimeoutInMilliseconds(300000);
Config.setChromiumOpenGlRenderer("angle");

// Some sandboxed environments block downloading Remotion's own Chrome Headless
// Shell but ship a Playwright Chromium. Reuse it there; on a normal machine
// this path will not exist and Remotion falls back to its managed browser.
const playwrightHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
}
