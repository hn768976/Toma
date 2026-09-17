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

// Tag output as Rec.709 with limited ("tv") range, which is how broadcast
// and stock H.264 is normally delivered. Left at the default, Remotion
// writes the file full-range, and players that assume limited range lift
// the blacks — very visible on near-black footage.
// Per-render settings (CRF, muting, x264 preset) live in the npm scripts
// rather than here, so they do not silently apply to other compositions.
Config.setColorSpace("bt709");

// The flight-grid compositions are WebGL. On a headless Linux box there is
// no GPU, so Chrome has to be pointed at its bundled SwiftShader/ANGLE
// software rasteriser or the canvas comes back black.
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
