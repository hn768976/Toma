/**
 * Note: When using the Node.JS APIs, the config file
 * doesn't apply. Instead, pass options directly to the APIs.
 *
 * All configuration options: https://remotion.dev/docs/config
 */

import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

Config.setRspack(true);
// WebGL 2 via ANGLE + SwiftShader ("swangle") works on any machine, GPU or not.
// On a machine with a GPU, set REMOTION_GL=angle for much faster renders.
Config.setChromiumOpenGlRenderer(
  (process.env.REMOTION_GL as "angle" | "swangle" | undefined) ?? "swangle",
);
Config.setVideoImageFormat("png");
Config.setOverwriteOutput(true);
Config.setCodec("h264");
Config.setPixelFormat("yuv420p");
Config.setCrf(16);

// Optional: reuse a locally installed Chrome Headless Shell instead of
// downloading one (set REMOTION_BROWSER=/path/to/headless_shell).
const browser = process.env.REMOTION_BROWSER;
if (browser && existsSync(browser)) {
  Config.setBrowserExecutable(browser);
}
