/**
 * Remotion configuration.
 *
 * Note: when rendering through the Node.js APIs this file is ignored --
 * pass the equivalent options to renderMedia() instead.
 * https://remotion.dev/docs/config
 */

import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

Config.setRspack(true);
Config.setOverwriteOutput(true);

// PNG frames keep the large, very soft gradients free of the extra
// chroma-subsampled JPEG noise before the H.264 encode gets to them.
Config.setVideoImageFormat("png");
Config.setPixelFormat("yuv420p");
Config.setCodec("h264");

// No audio: these are silent motion graphics, and without this Remotion
// muxes a silent AAC track that pads the file past its 20.000s duration.
Config.setMuted(true);

// Some sandboxed environments block downloading Remotion's own Chrome
// Headless Shell but ship a Playwright Chromium at this path. Reuse it
// there; on a normal machine the path is absent and Remotion falls back
// to its own managed browser.
const playwrightHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
}
