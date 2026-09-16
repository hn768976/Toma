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
// The scene is mostly near-black with fine, high-contrast detail
// (single-pixel particles, thin cube edges). At the default quality of
// 80 the intermediate frames pick up visible ringing around that
// detail before x264 ever sees them, so hand the encoder something
// effectively lossless and let CRF do the compressing.
Config.setJpegQuality(100);
// Without this, output is tagged yuvj420p (full range), which editors
// and players that ignore the tag render with lifted blacks -- very
// visible on a clip this dark. bt709 gives standard limited-range
// yuv420p with correct primaries/transfer tagging.
Config.setColorSpace("bt709");
Config.setOverwriteOutput(true);
Config.overrideBundlerConfig(enableTailwind);

// --- WebGPU ---------------------------------------------------------
// The 3D compositions render through three.js' WebGPURenderer. On a
// GPU-less machine Chromium can still supply a real WebGPU device via
// SwiftShader/Dawn, but only under the ANGLE-SwiftShader renderer --
// "swangle" expands to exactly --use-gl=angle --use-angle=swiftshader,
// which is the combination that yields a working adapter. Remotion
// already passes --enable-unsafe-webgpu itself.
Config.setChromiumOpenGlRenderer("swangle");
// Dawn needs its own process; --single-process (Remotion's Linux
// default) leaves navigator.gpu without an adapter.
Config.setChromiumMultiProcessOnLinux(true);
// Software-rasterised WebGPU compiles shaders and rasterises slowly
// enough to blow through the stock 30s budget on the first frame.
Config.setDelayRenderTimeoutInMilliseconds(300_000);

// Some sandboxed dev environments block downloading Remotion's own
// Chrome Headless Shell but ship a Playwright Chromium at this path.
// Reuse it there instead of downloading; on a normal machine this path
// won't exist and Remotion falls back to its default managed browser.
const playwrightHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
}
