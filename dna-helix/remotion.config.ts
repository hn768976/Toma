/**
 * Remotion CLI configuration for the DNA helix project.
 * (When using the Node.js APIs this file is ignored - pass options directly.)
 * All options: https://remotion.dev/docs/config
 */
import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

Config.setRspack(true);
// Lossless PNG frames + BT.709 (TV range) give accurate colour in the H.264 output.
Config.setVideoImageFormat("png");
Config.setOverwriteOutput(true);
Config.setDefaultPremountInSeconds(2);
// Software WebGL shader compilation can be slow on CPU-only machines.
Config.setDelayRenderTimeoutInMilliseconds(300000);

// Final deliverables: H.264 MP4, high quality.
Config.setCodec("h264");
Config.setPixelFormat("yuv420p");
Config.setCrf(16);
Config.setColorSpace("bt709");

// The scene is pure WebGL (Three.js). "swangle" (SwiftShader via ANGLE) works on
// every machine including GPU-less servers/CI. On a workstation with a GPU you
// can pass `--gl=angle` on the command line for a much faster render.
Config.setChromiumOpenGlRenderer("swangle");

// Sandboxed environments that cannot download Remotion's Chrome Headless Shell
// may ship a Playwright build instead. Use it when present; otherwise Remotion
// falls back to downloading its own managed browser.
const candidates = [
  "/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell",
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell",
];
const found = candidates.find((p) => existsSync(p));
if (found) {
  Config.setBrowserExecutable(found);
}
