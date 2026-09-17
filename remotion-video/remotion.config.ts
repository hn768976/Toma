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
// The cloud march is unrolled into the shader, so first compile of a cloud shot
// takes far longer than Remotion's 30s default allows for.
Config.setDelayRenderTimeoutInMilliseconds(600_000);
// PNG rather than JPEG for the intermediate frames. Every one of these shots is
// mostly smooth sky gradient, which is exactly what JPEG's default quality
// bands, and that banding survives into the H.264 encode.
Config.setVideoImageFormat("png");
Config.setOverwriteOutput(true);
Config.overrideBundlerConfig(enableTailwind);

/**
 * WebGPU is only exposed under Chrome's *new* headless mode, and only when the
 * renderer is allowed its own GPU process. Remotion's default Linux path uses
 * `--headless=old` plus `--single-process`, and under either of those
 * `navigator.gpu` is absent and three falls back to WebGL2. Both settings below
 * are therefore load-bearing for the WebGPU render path, not conveniences.
 */
Config.setChromeMode("chrome-for-testing");
Config.setChromiumMultiProcessOnLinux(true);

// Some sandboxed dev environments block downloading Chrome for Testing but
// ship a Playwright Chromium at this path. Reuse it there; on a normal machine
// the path won't exist and Remotion falls back to its own managed browser.
const playwrightChromium = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
if (existsSync(playwrightChromium)) {
  Config.setBrowserExecutable(playwrightChromium);
}
