/**
 * Note: when using the Node.JS APIs this file does not apply -- pass the
 * options directly to the APIs instead.
 *
 * All configuration options: https://remotion.dev/docs/config
 */

import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

Config.setRspack(true);
Config.setOverwriteOutput(true);

// PNG frames, not JPEG: the visible grain is the whole point of this clip, and
// JPEG's default quality softens exactly that high-frequency detail.
Config.setVideoImageFormat("png");
// Limited-range yuv420p. Capturing to JPEG instead would tag the stream
// yuvj420p (full range), which shifts levels on some players.
Config.setPixelFormat("yuv420p");
// Nothing here makes a sound; without this, ffmpeg still writes a silent track.
Config.setMuted(true);

// This project is WebGL, so headless Chrome needs a GL backend. "angle" is
// what it was developed and timed against; see the README.
Config.setChromiumOpenGlRenderer("angle");

// Some sandboxed environments block downloading Remotion's own Chrome Headless
// Shell but ship a Playwright Chromium at this path. On a normal machine the
// path does not exist and Remotion falls back to its managed browser.
const playwrightHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
}
