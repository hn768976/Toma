/**
 * Remotion CLI configuration.
 * All configuration options: https://remotion.dev/docs/config
 */
import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

Config.setRspack(true);
// WebGL 2 backend. "swangle" (ANGLE on SwiftShader, CPU) works on every machine,
// including headless servers without a GPU. On a workstation with a GPU you can
// render much faster with REMOTION_GL=angle (or pass --gl=angle).
const gl = (process.env.REMOTION_GL ?? "swangle") as "swangle" | "angle" | "egl" | "swiftshader" | "vulkan" | "angle-egl";
Config.setChromiumOpenGlRenderer(gl);
Config.setVideoImageFormat("jpeg");
Config.setJpegQuality(95);
Config.setOverwriteOutput(true);
Config.setCodec("h264");
Config.setPixelFormat("yuv420p");
// Standard broadcast-range BT.709 output (avoids full-range yuvj420p files).
Config.setColorSpace("bt709");
Config.setCrf(18);
Config.setConcurrency(3);
// Generous timeout: the first frame compiles shaders and builds textures.
Config.setDelayRenderTimeoutInMilliseconds(180000);

// Sandboxed environments that cannot download Remotion's Chrome Headless Shell
// can point REMOTION_BROWSER_EXECUTABLE at a local Chromium headless shell.
const customBrowser = process.env.REMOTION_BROWSER_EXECUTABLE;
if (customBrowser && existsSync(customBrowser)) {
  Config.setBrowserExecutable(customBrowser);
}
