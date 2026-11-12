/**
 * Note: When using the Node.JS APIs, the config file
 * doesn't apply. Instead, pass options directly to the APIs.
 *
 * All configuration options: https://remotion.dev/docs/config
 */

import { Config } from "@remotion/cli/config";

Config.setRspack(true);
// WebGL2 needs a GL backend in headless Chrome. "swangle" (ANGLE on
// SwiftShader, CPU-only) works on every machine, including servers without a
// GPU. On a machine with a GPU, pass --gl=angle for much faster renders.
Config.setChromiumOpenGlRenderer("swangle");
Config.setVideoImageFormat("jpeg");
Config.setJpegQuality(95);
Config.setCodec("h264");
Config.setPixelFormat("yuv420p");
// Tag output as standard limited-range BT.709 (yuv420p) instead of full-range JPEG colour.
Config.setColorSpace("bt709");
Config.setCrf(18);
Config.setOverwriteOutput(true);
// Optional: use a pre-installed Chrome / Chrome Headless Shell instead of the
// one Remotion downloads automatically (useful on offline / locked-down hosts).
if (process.env.REMOTION_BROWSER_EXECUTABLE) {
  Config.setBrowserExecutable(process.env.REMOTION_BROWSER_EXECUTABLE);
}
