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

// three.js WebGPU needs Chromium's GPU process. Remotion passes
// --single-process by default on Linux, under which the WebGPU device is
// dropped mid-render ("Instance dropped in popErrorScope"), so opt out.
Config.setChromiumMultiProcessOnLinux(true);
Config.setChromiumOpenGlRenderer("swangle");

// A 4K frame on a software rasteriser takes a while; don't time out on it.
Config.setDelayRenderTimeoutInMilliseconds(300000);
// No composition in this project has audio. Without this, Remotion muxes a
// silent AAC track whose duration is rounded up to its own frame grid, which
// makes the container run 10.048s where the video track runs exactly 10.000s.
Config.setMuted(true);

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
