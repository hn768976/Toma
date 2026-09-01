/**
 * Remotion configuration.
 * Note: when using the Node.js APIs this file does not apply — pass options
 * directly to those APIs instead.
 * All options: https://remotion.dev/docs/config
 */

import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
// The piece has no audio, so no silent track should be muxed into the output.
Config.setMuted(true);
Config.setEnforceAudioTrack(false);

// Some sandboxed environments block downloading Remotion's own Chrome Headless
// Shell but ship a Playwright Chromium at this path. Reuse it there; on a
// normal machine the path won't exist and Remotion uses its managed browser.
const playwrightHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
}
