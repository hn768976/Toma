/**
 * Config for the Remotion CLI. When rendering through the Node APIs these
 * options do not apply and must be passed to the API directly.
 * https://remotion.dev/docs/config
 */
import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);

// yuv420p keeps the mp4 playable everywhere; CRF is passed per render on the
// command line so the 1080p previews and the 4K masters can differ.
Config.setPixelFormat("yuv420p");
Config.setCodec("h264");

// Without this, JPEG frames come through as full-range and ffprobe reports the
// stream as yuvj420p rather than yuv420p. bt709 tags it as limited range.
Config.setColorSpace("bt709");

// These clips carry no audio. Remotion adds a silent AAC track by default;
// both lines together mean the delivered mp4 has no audio stream at all.
Config.setMuted(true);
Config.setEnforceAudioTrack(false);

// Some sandboxed environments block Remotion's own Chrome Headless Shell
// download but ship Playwright's copy of it. Use that when it is there; on a
// normal machine this path does not exist and Remotion downloads its own.
const playwrightHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
}
