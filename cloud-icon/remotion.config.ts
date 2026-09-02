/**
 * Remotion config. Note: when using the Node.JS APIs the config file does not
 * apply — pass options directly to those APIs instead.
 * All options: https://remotion.dev/docs/config
 */
import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

Config.setRspack(true);
Config.setVideoImageFormat("jpeg");
// The piece has no audio. Without this, Remotion pads the mp4 with a silent
// AAC track; this leaves the output video-only.
Config.setEnforceAudioTrack(false);
Config.setOverwriteOutput(true);
// Canvas work is CPU-bound here; give each frame room to finish.
Config.setDelayRenderTimeoutInMilliseconds(120000);

// Some sandboxed environments block Remotion's own Chrome Headless Shell
// download but ship a Playwright Chromium. Use it when present; on a normal
// machine this path won't exist and Remotion falls back to its own browser.
const playwrightHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
}
