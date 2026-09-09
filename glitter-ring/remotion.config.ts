/**
 * Remotion config. Node.JS render APIs do not read this file; the CLI does.
 * https://remotion.dev/docs/config
 */
import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
// Additive glitter over a smooth dark gradient bands badly at default CRF.
Config.setCrf(15);
Config.setPixelFormat("yuv420p");
// Tag the output bt709/limited range. Without it the file lands as yuvj420p
// with bt470bg primaries, which some NLEs read as a colour shift.
Config.setColorSpace("bt709");
Config.setCodec("h264");
// These clips carry no sound. Without this, Remotion muxes a silent AAC track
// into the mp4 and the file no longer reports as video-only under ffprobe.
Config.setMuted(true);
Config.setEnforceAudioTrack(false);

// Some sandboxed environments block downloading Remotion's own Chrome Headless
// Shell but ship a Playwright Chromium. Reuse it when present; on a normal
// machine this path does not exist and Remotion uses its managed browser.
const playwrightHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
}
