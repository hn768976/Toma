/**
 * Remotion CLI configuration.
 * All configuration options: https://remotion.dev/docs/config
 */
import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setJpegQuality(95);
Config.setOverwriteOutput(true);
Config.setCodec("h264");
Config.setPixelFormat("yuv420p");
// Standard limited-range BT.709 output (yuv420p, tv range) for broad player compatibility.
Config.setColorSpace("bt709");
Config.setCrf(16);
// WebGL 2 is required. Default "swangle" (SwiftShader via ANGLE) works on any
// machine, including servers without a GPU. On a machine with a GPU, set
// REMOTION_GL=angle (or pass --gl=angle) for much faster renders.
type GlRenderer = "swangle" | "angle" | "egl" | "swiftshader" | "vulkan" | "angle-egl";
Config.setChromiumOpenGlRenderer(
  (process.env.REMOTION_GL as GlRenderer | undefined) ?? "swangle",
);
Config.setTimeoutInMilliseconds(240000);

// Optional: reuse a pre-installed Chromium headless shell when one exists
// (e.g. sandboxed CI). Otherwise Remotion downloads its own browser.
const candidates = [
  process.env.REMOTION_BROWSER_EXECUTABLE,
  "/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell",
].filter(Boolean) as string[];
const found = candidates.find((p) => existsSync(p));
if (found) {
  Config.setBrowserExecutable(found);
}
