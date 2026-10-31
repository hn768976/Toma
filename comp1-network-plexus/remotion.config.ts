/**
 * Note: When using the Node.JS APIs, the config file
 * doesn't apply. Instead, pass options directly to the APIs.
 *
 * All configuration options: https://remotion.dev/docs/config
 */

import { Config } from "@remotion/cli/config";

Config.setRspack(true);
// SwiftShader-backed ANGLE works everywhere (including GPU-less servers/CI).
// On a machine with a GPU you may switch this to "angle" for faster renders.
Config.setChromiumOpenGlRenderer("swangle");
// Lossless intermediate frames: avoids JPEG blocking in the dark gradients.
Config.setVideoImageFormat("png");
Config.setCodec("h264");
Config.setPixelFormat("yuv420p");
// The references have no audio track – export video only.
Config.setMuted(true);
Config.setCrf(16);
Config.setConcurrency(4);
// Scene generation can take a few seconds per browser tab in software GL.
Config.setDelayRenderTimeoutInMilliseconds(180000);

// Optional: use a locally installed Chrome / Chrome Headless Shell instead of
// the one Remotion downloads automatically (useful on offline machines).
if (process.env.REMOTION_BROWSER_EXECUTABLE) {
  Config.setBrowserExecutable(process.env.REMOTION_BROWSER_EXECUTABLE);
}
