/**
 * Note: when using the Node.JS APIs the config file doesn't apply —
 * pass options directly to the APIs instead.
 *
 * All configuration options: https://remotion.dev/docs/config
 */

import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
// Quality matters more than file size for a glitter field: the smooth
// glow gradient is a banding risk and dense sparkles are hard to encode.
Config.setCrf(15);
Config.setPixelFormat("yuv420p");
Config.setCodec("h264");
// Tag the output as limited-range bt709 rather than letting the
// full-range JPEG frame sequence come through as yuvj420p.
Config.setColorSpace("bt709");
// The clip carries no sound: without this Remotion muxes in a silent
// AAC track, which the spec explicitly rules out.
Config.setEnforceAudioTrack(false);
Config.setMuted(true);

// Some sandboxed dev environments block downloading Remotion's own
// Chrome Headless Shell but ship a Playwright Chromium at this path.
// Reuse it there instead of downloading; on a normal machine this path
// won't exist and Remotion falls back to its default managed browser.
const playwrightHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
}
