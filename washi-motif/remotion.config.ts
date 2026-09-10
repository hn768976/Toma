/**
 * Remotion configuration.
 *
 * Note: when using the Node.js APIs this file does not apply — pass options
 * directly to the APIs instead.
 */
import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

Config.setRspack(true);
Config.setStillImageFormat("png");
Config.setOverwriteOutput(true);
// Stills are large (3840x2560) and every pixel is drawn in one pass.
Config.setDelayRenderTimeoutInMilliseconds(300000);
Config.setChromiumOpenGlRenderer("angle");

// Some sandboxed environments block downloading Remotion's own Chrome Headless
// Shell but ship a Playwright Chromium. Reuse it there; on a normal machine
// this path does not exist and Remotion falls back to its managed browser.
const playwrightHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
}
