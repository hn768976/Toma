/**
 * Project-wide render defaults.
 *
 * Note: when rendering through the Node APIs this file does not apply -
 * pass the same options directly to the API instead.
 */

import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);

// WebGL needs a real GL backend in headless Chromium. "angle" picks the
// platform default (a GPU where one exists); "swiftshader" is the CPU
// fallback and is much slower but works on a headless box with no GPU.
Config.setChromiumOpenGlRenderer("angle");

// H.264 defaults for the 4K masters. --crf is overridden per command in the
// README; 16 is the archival setting used for delivery.
Config.setCodec("h264");
Config.setCrf(16);

// Broadcast-range BT.709.
//
// Remotion's frames are full-range RGB, and left alone the encoder tags the
// output yuvj420p / color_range=pc. That is self-consistent, but any tool
// that ignores the range flag - and plenty of players and NLEs do - reads it
// as limited range, crushing the blacks and clipping the highlights. Setting
// the colour space makes the encoder do the range conversion properly and
// emit yuv420p with color_range=tv.
//
// setPixelFormat("yuv420p") alone does NOT achieve this - it leaves the
// full-range tag in place, which is why it is not used here.
Config.setColorSpace("bt709");

// These compositions have no audio by design. Without this, Remotion still
// muxes a silent AAC track into the output.
Config.setMuted(true);

// Some sandboxed environments block Remotion's own Chrome Headless Shell
// download but ship a Playwright Chromium. Reuse it when it is present; on a
// normal machine this path does not exist and Remotion uses its own browser.
const playwrightHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
}
