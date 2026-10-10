/**
 * Remotion CLI config. (When rendering through the Node APIs, pass the same
 * options directly instead.)
 */
import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("png");
Config.setOverwriteOutput(true);
// WebGL2 in headless Chromium: ANGLE is the reliable backend.
Config.setChromiumOpenGlRenderer("angle");
// Each frame is a heavy GPU job; keep the default concurrency modest.
Config.setConcurrency(2);
Config.setDelayRenderTimeoutInMilliseconds(120000);

// Sandboxed environments that block Remotion's own headless shell download
// but ship a Playwright Chromium: reuse it. Elsewhere this path won't exist
// and Remotion uses its managed browser.
const playwrightHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
}
