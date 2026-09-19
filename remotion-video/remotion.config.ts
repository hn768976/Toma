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
// PNG intermediates, not JPEG. These plates are fine bright particles on near
// black, which is exactly where JPEG puts visible ringing around every dot --
// and it also drags the pipeline into full-range yuvj420p.
Config.setVideoImageFormat("png");
Config.setOverwriteOutput(true);
Config.overrideBundlerConfig(enableTailwind);

// The abstract plates are drawn with PixiJS + custom WebGL shaders, so the
// renderer needs a real GL context. "swangle" is SwiftShader behind ANGLE: it
// works everywhere, including headless CI and containers without a GPU. On a
// machine with a GPU, "angle" or "egl" renders the same frames much faster --
// override with `--gl=angle` on the command line.
Config.setChromiumOpenGlRenderer("swangle");

// Deliverables are H.264 / MP4. CRF 16 keeps the fine glitter and the dark
// gradients clean; these plates are unforgiving of compression noise.
Config.setCodec("h264");
Config.setCrf(16);
Config.setPixelFormat("yuv420p");
Config.setColorSpace("bt709");

// The reference plates are silent. Without this Remotion muxes in a silent AAC
// track, which also stretches the file past the exact frame-count duration
// (20.000s becomes 20.054s).
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
