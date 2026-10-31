/**
 * Note: When using the Node.JS APIs, the config file
 * doesn't apply. Instead, pass options directly to the APIs.
 *
 * All configuration options: https://remotion.dev/docs/config
 */

import { Config } from "@remotion/cli/config";

Config.setRspack(true);
// WebGL in headless Chromium. "swangle" (SwiftShader via ANGLE) works on any
// machine, including GPU-less servers/CI. On a workstation with a GPU you
// can set REMOTION_GL=angle for faster renders.
Config.setChromiumOpenGlRenderer(
  (process.env.REMOTION_GL as "swangle" | "angle" | undefined) ?? "swangle",
);
Config.setVideoImageFormat("png");
Config.setCodec("h264");
Config.setPixelFormat("yuv420p");
Config.setCrf(16);
Config.setConcurrency(2);

// Optional: point Remotion at an existing Chromium / headless-shell binary
// (useful on offline / sandboxed machines). Otherwise Remotion downloads
// its own Chrome Headless Shell on first render.
if (process.env.REMOTION_BROWSER_EXECUTABLE) {
  Config.setBrowserExecutable(process.env.REMOTION_BROWSER_EXECUTABLE);
}
