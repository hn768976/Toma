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
// JPEG at near-maximum quality for the intermediate frames. PNG is the obvious
// choice for skies this smooth, but capturing a 1080p page as PNG costs more
// per frame here than rendering it does — it roughly doubled the render. At 95
// there is no banding left to see once the H.264 encode has had its say.
Config.setVideoImageFormat("jpeg");
Config.setJpegQuality(95);
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
