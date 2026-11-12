/**
 * Remotion CLI configuration for the Earth Network Countdown project.
 * (When using the Node.js APIs this file does not apply; pass options directly.)
 * All options: https://remotion.dev/docs/config
 */
import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

Config.setRspack(true);
Config.setVideoImageFormat("jpeg");
Config.setJpegQuality(95);
Config.setOverwriteOutput(true);
Config.setCodec("h264");
Config.setPixelFormat("yuv420p");
Config.setCrf(12); // high-quality 4K master (visually lossless)
Config.setColorSpace("bt709");
Config.setConcurrency(2);

// The scenes are drawn with raw WebGL 2. "swangle" (ANGLE on SwiftShader)
// provides a WebGL 2 context on every machine, including GPU-less servers,
// and renders deterministically. On a workstation with a GPU you may pass
// `--gl=angle` on the command line for faster renders.
Config.setChromiumOpenGlRenderer("swangle");

// Optional: if a sandboxed machine cannot download Remotion's own Chrome
// Headless Shell, point REMOTION_BROWSER at any compatible headless shell.
// A Playwright-provided shell is picked up automatically when present.
const candidates = [
  process.env.REMOTION_BROWSER,
  "/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell",
].filter((p): p is string => Boolean(p));
const browser = candidates.find((p) => existsSync(p));
if (browser) {
  Config.setBrowserExecutable(browser);
}
