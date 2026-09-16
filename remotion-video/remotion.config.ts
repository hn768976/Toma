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
Config.setJpegQuality(95);
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

// The tile-field compositions drive a three.js WebGPURenderer. In a headless
// render there is no GPU, so three transparently falls back to its WebGL2
// backend -- SwiftShader/ANGLE is what actually rasterises it.
Config.setChromiumOpenGlRenderer("swangle");

// Software rasterising ~31k instanced tiles plus DOF and bloom takes a while,
// especially on the first frame while shaders compile.
Config.setDelayRenderTimeoutInMilliseconds(300000);
