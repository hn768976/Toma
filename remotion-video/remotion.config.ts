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
