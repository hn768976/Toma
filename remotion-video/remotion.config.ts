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

// --- three.js / WebGPU render settings -------------------------------------
// The scenes render through three.js' WebGPURenderer. Chromium only exposes a
// WebGPU adapter here when it can reach a Vulkan driver, which on a GPU-less
// machine means SwiftShader. Two settings are load-bearing:
//   * `swiftshader` as the OpenGL renderer, so ANGLE/Dawn bind to the bundled
//     SwiftShader Vulkan ICD.
//   * multi-process Chromium, because Remotion's default `--single-process`
//     on Linux has no separate GPU process and `requestAdapter()` then either
//     returns null or the device is dropped mid-render.
Config.setChromiumOpenGlRenderer("swiftshader");
Config.setChromiumMultiProcessOnLinux(true);
// Software rasterising 4K frames is slow; give each frame room to finish.
Config.setDelayRenderTimeoutInMilliseconds(300_000);
Config.setVideoImageFormat("jpeg");
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
