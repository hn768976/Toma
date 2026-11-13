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
Config.setCodec("h264");
Config.setPixelFormat("yuv420p");
Config.setCrf(16);

// The scene is rendered with Three.js (WebGL 2). "swangle" is ANGLE on top of
// the SwiftShader software rasteriser, so it renders identically on machines
// with or without a GPU. On a machine with a GPU you can speed rendering up
// with `--gl=angle` on the command line.
Config.setChromiumOpenGlRenderer("swangle");

// Optional: point Remotion at an already-installed Chrome Headless Shell
// (useful in sandboxes that block Remotion's own browser download).
// Otherwise Remotion downloads and manages its own browser as usual.
const customBrowser =
  process.env.REMOTION_BROWSER_EXECUTABLE ??
  "/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell";
if (existsSync(customBrowser)) {
  Config.setBrowserExecutable(customBrowser);
}
