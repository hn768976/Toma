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
Config.setCrf(16);
// WebGL content: use ANGLE with SwiftShader so rendering works on machines
// without a GPU (CI, containers). Override with --gl=angle on a GPU machine.
Config.setChromiumOpenGlRenderer("swangle");
// Frames are independent and deterministic, so they can be rendered in parallel.
Config.setConcurrency(4);

// Optional: some sandboxed environments block downloading Remotion's own
// Chrome Headless Shell but ship a Playwright one. Use it if present;
// on a normal machine Remotion downloads and uses its default browser.
const candidates = [
  process.env.REMOTION_BROWSER_EXECUTABLE,
  "/opt/pw-browsers/chromium_headless_shell-1243/chrome-linux/headless_shell",
  "/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell",
].filter(Boolean) as string[];
const found = candidates.find((p) => existsSync(p));
if (found) {
  Config.setBrowserExecutable(found);
}
