/**
 * Note: When using the Node.JS APIs, the config file
 * doesn't apply. Instead, pass options directly to the APIs.
 *
 * All configuration options: https://remotion.dev/docs/config
 */

import { Config } from "@remotion/cli/config";

Config.setRspack(true);
// WebGL via ANGLE + SwiftShader (CPU) works on every machine, including headless
// servers without a GPU. On a machine with a GPU pass `--gl=angle` to go faster.
Config.setChromiumOpenGlRenderer("swangle");
Config.setVideoImageFormat("jpeg");
Config.setJpegQuality(95);
Config.setOverwriteOutput(true);
Config.setCodec("h264");
Config.setPixelFormat("yuv420p");
// Tag + encode as standard BT.709 TV-range video (plain yuv420p, not yuvj420p).
Config.setColorSpace("bt709");
Config.setCrf(16);
// WebGL frames are heavy; long single frames on CPU-only machines need time.
Config.setDelayRenderTimeoutInMilliseconds(120000);

// Optional: reuse a locally installed Chrome Headless Shell instead of letting
// Remotion download one (useful in offline / sandboxed environments).
// Set REMOTION_BROWSER_EXECUTABLE=/path/to/chrome-headless-shell to enable.
if (process.env.REMOTION_BROWSER_EXECUTABLE) {
  Config.setBrowserExecutable(process.env.REMOTION_BROWSER_EXECUTABLE);
}
