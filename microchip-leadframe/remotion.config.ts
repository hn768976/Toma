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

// Final encode: H.264 / yuv420p MP4.
Config.setCodec("h264");
Config.setPixelFormat("yuv420p");
Config.setCrf(16);
// Tag and convert to standard BT.709 limited range (plain yuv420p, plays everywhere).
Config.setColorSpace("bt709");

// The compositions are drawn with WebGL 2 (Three.js).
// "angle" uses the GPU on macOS / Windows; on Linux (CI, containers, servers)
// "swangle" is a software rasteriser that works without a GPU.
// Override with REMOTION_GL=angle|swangle|egl|vulkan if needed.
const gl = (process.env.REMOTION_GL ??
  (process.platform === "linux" ? "swangle" : "angle")) as
  | "angle"
  | "swangle"
  | "egl"
  | "vulkan";
Config.setChromiumOpenGlRenderer(gl);

// Each frame is a heavy WebGL draw; give slow machines plenty of headroom.
Config.setDelayRenderTimeoutInMilliseconds(300000);

// Optional: reuse an already-installed Chrome Headless Shell instead of
// letting Remotion download its own (useful in sandboxes without internet).
const customBrowser = process.env.REMOTION_BROWSER_EXECUTABLE;
if (customBrowser && existsSync(customBrowser)) {
  Config.setBrowserExecutable(customBrowser);
}
