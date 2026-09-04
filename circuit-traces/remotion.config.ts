/**
 * Note: when rendering through the Node.JS APIs this file does not apply —
 * pass the options directly to the APIs instead.
 *
 * All configuration options: https://remotion.dev/docs/config
 */

import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

Config.setRspack(true);
Config.setOverwriteOutput(true);

// The board is near-black with long, shallow gradients. A JPEG intermediate
// bands visibly in those regions before H.264 ever sees the frame, so capture
// the frames losslessly and let the encoder do the only lossy step.
Config.setVideoImageFormat("png");
Config.setPixelFormat("yuv420p");
Config.setCrf(16);

// Some sandboxed dev environments block downloading Remotion's own Chrome
// Headless Shell but ship a Playwright Chromium at this path. Reuse it there;
// on a normal machine the path won't exist and Remotion falls back to its
// own managed browser.
const playwrightHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
}
