/**
 * Remotion CLI configuration.
 * All configuration options: https://remotion.dev/docs/config
 */
import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

Config.setRspack(true);
// WebGL renderer. "swangle" (ANGLE on SwiftShader, CPU) works on every machine,
// including headless servers without a GPU, and gives deterministic output.
// On a workstation with a GPU you can speed things up with REMOTION_GL=angle.
type GlRenderer = "swangle" | "angle" | "egl" | "swiftshader" | "vulkan" | "angle-egl";
Config.setChromiumOpenGlRenderer((process.env.REMOTION_GL as GlRenderer) ?? "swangle");
Config.setVideoImageFormat("jpeg");
Config.setJpegQuality(95);
Config.setOverwriteOutput(true);
Config.setCodec("h264");
Config.setPixelFormat("yuv420p");
Config.setColorSpace("bt709");

// Optional: use an already-installed Chrome / Chromium instead of letting
// Remotion download its Chrome Headless Shell (e.g. in offline sandboxes).
//   REMOTION_BROWSER_EXECUTABLE=/path/to/chrome npx remotion render ...
const candidates = [
  process.env.REMOTION_BROWSER_EXECUTABLE,
  "/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell",
].filter((p): p is string => Boolean(p));
const browser = candidates.find((p) => existsSync(p));
if (browser) {
  Config.setBrowserExecutable(browser);
}
