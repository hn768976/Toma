/**
 * Note: When using the Node.JS APIs, the config file
 * doesn't apply. Instead, pass options directly to the APIs.
 *
 * All configuration options: https://remotion.dev/docs/config
 */

import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

Config.setRspack(true);
Config.setVideoImageFormat("jpeg");
Config.setJpegQuality(95);
Config.setOverwriteOutput(true);
Config.setDefaultPremountInSeconds(2);

// Deliverable encoding: H.264 MP4, 30 fps (set on the compositions).
Config.setCodec("h264");
Config.setPixelFormat("yuv420p");
Config.setCrf(19);
Config.setColorSpace("bt709"); // yuv420p, TV range, BT.709 tagged

// Three.js / WebGL 2. "swangle" (ANGLE on SwiftShader) renders on the CPU
// and works on any machine, including headless servers without a GPU.
// On a workstation with a GPU, pass --gl=angle for much faster renders.
Config.setChromiumOpenGlRenderer("swangle");

// Sandboxed environments that cannot download Remotion's Chrome Headless
// Shell can point REMOTION_BROWSER at a local Chromium. A Playwright
// headless shell at the path below is picked up automatically.
const localShell =
  process.env.REMOTION_BROWSER ??
  "/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell";
if (existsSync(localShell)) {
  Config.setBrowserExecutable(localShell);
}
