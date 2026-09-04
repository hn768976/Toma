/**
 * Remotion configuration.
 *
 * Note: when rendering through the Node.js APIs this file is ignored —
 * pass the options directly instead.
 */

import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

Config.setRspack(true);
Config.setDelayRenderTimeoutInMilliseconds(180000);
Config.setOverwriteOutput(true);

// Still frames and video frames are captured as PNG so the long, smooth
// fog gradients don't pick up JPEG blocking before they reach the encoder.
Config.setVideoImageFormat("png");
Config.setStillImageFormat("png");

Config.setCodec("h264");
Config.setPixelFormat("yuv420p");
Config.setCrf(16);

// Some sandboxed environments block downloading Remotion's own Chrome
// Headless Shell but ship a Playwright Chromium at this path. Reuse it
// there; on a normal machine the path is absent and Remotion falls back
// to its own managed browser.
const playwrightHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
}
