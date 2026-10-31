/**
 * Note: When using the Node.JS APIs, the config file
 * doesn't apply. Instead, pass options directly to the APIs.
 *
 * All configuration options: https://remotion.dev/docs/config
 */

import { Config } from "@remotion/cli/config";

Config.setRspack(true);

// GPU-accelerated WebGL by default. On machines without a GPU set
// REMOTION_GL=swangle (SwiftShader software rendering).
type GlRenderer = Parameters<typeof Config.setChromiumOpenGlRenderer>[0];
Config.setChromiumOpenGlRenderer(
  (process.env.REMOTION_GL as GlRenderer | undefined) ?? "angle",
);

// Optional: use a locally installed Chrome Headless Shell instead of letting
// Remotion download one (useful offline / in locked-down CI).
if (process.env.REMOTION_BROWSER_EXECUTABLE) {
  Config.setBrowserExecutable(process.env.REMOTION_BROWSER_EXECUTABLE);
}

// Delivery format: H.264 MP4, standard limited-range yuv420p.
// PNG intermediates avoid JPEG artefacts in the dark gradients and keep the
// encoder on limited-range yuv420p (JPEG frames would yield yuvj420p).
Config.setVideoImageFormat("png");
Config.setCodec("h264");
Config.setCrf(16);
Config.setPixelFormat("yuv420p");
