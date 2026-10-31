/**
 * Remotion CLI configuration.
 * All configuration options: https://remotion.dev/docs/config
 */
import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

Config.setRspack(true);
Config.setVideoImageFormat("jpeg");
Config.setJpegQuality(95);
Config.setOverwriteOutput(true);
Config.setDefaultPremountInSeconds(2);

// Delivery format: H.264 MP4, 8-bit 4:2:0 (plays everywhere), high quality.
Config.setCodec("h264");
Config.setPixelFormat("yuv420p");
Config.setCrf(16);
Config.setColorSpace("bt709");

// The scene is rendered with WebGL 2 (Three.js). "angle" uses the GPU when one
// is available; on GPU-less servers set REMOTION_GL=swangle (software WebGL).
Config.setChromiumOpenGlRenderer(
  (process.env.REMOTION_GL as "angle" | "swangle" | "egl" | "swiftshader") ??
    "angle",
);
// Long first-frame budget: 8K textures are decoded on the first frame.
Config.setDelayRenderTimeoutInMilliseconds(120000);

// Some sandboxed environments block downloading Remotion's own Chrome
// Headless Shell but ship a Playwright one. Reuse it if present; on a normal
// machine this path does not exist and Remotion uses its managed browser.
const playwrightHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell";
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
}
