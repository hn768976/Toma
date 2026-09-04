/**
 * Config used by the Remotion CLI (studio / render / still).
 * When rendering through the Node APIs these options must be passed directly.
 */

import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
// The field is pure DOM text: 1x is exactly what the composition declares.
Config.setScale(1);
Config.setCodec("h264");
Config.setPixelFormat("yuv420p");
Config.setCrf(16);
// A wall of text needs a moment to lay out at 4K.
Config.setDelayRenderTimeoutInMilliseconds(120000);

// Some sandboxed environments block downloading Remotion's own Chrome Headless
// Shell but ship a Playwright Chromium at this path. Reuse it there; on a normal
// machine the path does not exist and Remotion uses its managed browser.
const playwrightHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
}
