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
// PNG intermediates rather than JPEG. JPEG frames arrive as full-range
// yuvj420p and add compression artefacts to a chain where smooth pastel
// gradients are the whole point.
Config.setVideoImageFormat("png");
Config.setPixelFormat("yuv420p");

// No composition here has audio. Without these Remotion writes a silent AAC
// track, which adds an audio stream and pushes the container duration past
// the exact 10.000s / 20.000s the serum clips are meant to be.
Config.setEnforceAudioTrack(false);
Config.setMuted(true);

// Banding: x264 quantises a 1-LSB dither away in flat areas. See
// SERUM_README.md, "Banding".
Config.setCrf(14);

// The serum compositions are WebGL, so Chromium needs a GL backend. "angle"
// uses the GPU where there is one and falls back to SwiftShader where not.
Config.setChromiumOpenGlRenderer("angle");
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
