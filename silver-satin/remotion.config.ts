/**
 * Note: When using the Node.JS APIs, the config file
 * doesn't apply. Instead, pass options directly to the APIs.
 *
 * All configuration options: https://remotion.dev/docs/config
 */

import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

Config.setRspack(true);
Config.setVideoImageFormat("jpeg");
Config.setJpegQuality(95);
Config.setOverwriteOutput(true);
Config.setDefaultPremountInSeconds(2);

// Final deliverables: H.264 MP4, high quality, broadly compatible pixel format.
Config.setCodec("h264");
Config.setPixelFormat("yuv420p");
Config.setCrf(14);

// The compositions are WebGL 2 shaders. "angle" uses the GPU when one is
// present; on GPU-less machines/servers pass `--gl=swangle` (SwiftShader).
Config.setChromiumOpenGlRenderer("angle");

// Shader frames at 3840x2160 can take a few seconds each on CPU renderers.
Config.setDelayRenderTimeoutInMilliseconds(120000);

// Sandboxed environments that block downloading Remotion's Chrome Headless
// Shell but ship a Playwright build can point at it via REMOTION_BROWSER.
const customBrowser = process.env.REMOTION_BROWSER;
if (customBrowser && existsSync(customBrowser)) {
  Config.setBrowserExecutable(customBrowser);
}
