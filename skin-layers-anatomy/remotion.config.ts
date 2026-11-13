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
// Standard HD colour tagging (limited-range BT.709) for broad player support.
Config.setColorSpace("bt709");
Config.setCrf(16);

// The scene is rendered with Three.js (WebGL 2). On Linux servers without a
// GPU, "swangle" (software ANGLE) is the reliable choice; elsewhere use ANGLE.
Config.setChromiumOpenGlRenderer(
  process.platform === "linux" ? "swangle" : "angle",
);

// Some sandboxed environments cannot download Remotion's Chrome Headless
// Shell but ship one at this path. On a normal machine the path does not
// exist and Remotion falls back to its own managed browser.
const sandboxBrowser =
  "/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell";
if (existsSync(sandboxBrowser)) {
  Config.setBrowserExecutable(sandboxBrowser);
}
