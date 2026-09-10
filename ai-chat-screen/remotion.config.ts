/**
 * Remotion CLI configuration.
 *
 * Note: when rendering through the Node.js APIs this file does not apply —
 * pass the equivalent options directly to those APIs instead.
 * https://remotion.dev/docs/config
 */

import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("png");
Config.setOverwriteOutput(true);

// This clip has no audio and must ship with no audio track at all.
// Remotion otherwise muxes in a silent AAC stream by default.
Config.setMuted(true);
Config.setEnforceAudioTrack(false);

// Some sandboxed CI/dev environments block downloading Remotion's own
// Chrome Headless Shell but ship a Playwright Chromium at this path.
// Reuse it there; on a normal machine the path is absent and Remotion
// falls back to its own managed browser download.
const playwrightHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
}
