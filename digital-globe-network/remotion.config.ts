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
Config.setCodec("h264");
Config.setPixelFormat("yuv420p");
Config.setCrf(16);
Config.setColorSpace("bt709");
// WebGL backend. "swangle" (ANGLE on SwiftShader, CPU) works on every machine,
// including headless servers without a GPU. On a workstation with a GPU you can
// render faster with:  REMOTION_GL=angle npx remotion render ...
type GlRenderer = "angle" | "swangle" | "egl" | "swiftshader" | "vulkan" | "angle-egl";
Config.setChromiumOpenGlRenderer((process.env.REMOTION_GL as GlRenderer | undefined) ?? "swangle");

// Sandboxed environments that cannot download Remotion's managed Chrome
// Headless Shell can point REMOTION_BROWSER_EXECUTABLE at a local one.
// A Playwright headless shell is used automatically if present; otherwise
// Remotion downloads and uses its own browser.
const candidates = [
  process.env.REMOTION_BROWSER_EXECUTABLE,
  "/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell",
].filter(Boolean) as string[];
const browser = candidates.find((p) => existsSync(p));
if (browser) {
  Config.setBrowserExecutable(browser);
}
