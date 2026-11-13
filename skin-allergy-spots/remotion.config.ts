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
Config.setCodec("h264");
Config.setPixelFormat("yuv420p");
Config.setCrf(16);

// The scenes are WebGL 2. "swangle" (software ANGLE) works on any machine,
// including ones without a GPU. On a machine with a GPU pass --gl=angle
// to the render command for much faster renders.
Config.setChromiumOpenGlRenderer("swangle");

// Optional: point Remotion at an existing Chrome Headless Shell instead of
// letting it download its own (useful in sandboxes without download access).
const browser = process.env.REMOTION_BROWSER_EXECUTABLE;
if (browser && existsSync(browser)) {
  Config.setBrowserExecutable(browser);
}
