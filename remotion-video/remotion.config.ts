/**
 * Note: When using the Node.JS APIs, the config file
 * doesn't apply. Instead, pass options directly to the APIs.
 *
 * All configuration options: https://remotion.dev/docs/config
 */

import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";
import { enableTailwind } from '@remotion/tailwind-v4';

Config.setRspack(true);
Config.setVideoImageFormat("jpeg");
// The geodata HUD compositions carry no audio. Without both of these Remotion
// muxes a silent AAC track, which also stretches the file past an exact
// 30.000s.
Config.setMuted(true);
Config.setEnforceAudioTrack(false);
// GeoHudTilted renders through @remotion/three. Headless Chrome has no GPU
// here, so WebGL needs an explicit renderer; "swangle" (software ANGLE) works
// everywhere and renders identically on every machine. On a box with a GPU,
// "angle" is faster.
Config.setChromiumOpenGlRenderer("swangle");
Config.setOverwriteOutput(true);
Config.overrideBundlerConfig(enableTailwind);

// Some sandboxed dev environments block downloading Remotion's own
// Chrome Headless Shell but ship a Playwright Chromium at this path.
// Reuse it there instead of downloading; on a normal machine this path
// won't exist and Remotion falls back to its default managed browser.
const playwrightHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
}
