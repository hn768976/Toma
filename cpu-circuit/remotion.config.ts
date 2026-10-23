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
// WebGL 2 needs a GL backend in headless Chrome. "angle" works on GPU-less
// machines (falls back to SwiftShader) as well as on desktops.
Config.setChromiumOpenGlRenderer("angle");
Config.setCodec("h264");
Config.setPixelFormat("yuv420p");
// Tag output as BT.709 limited range (standard HD/UHD video levels).
Config.setColorSpace("bt709");

// Some sandboxed environments block downloading Remotion's Chrome Headless
// Shell but ship a Playwright one at this path. Use it when present;
// elsewhere Remotion downloads and uses its own managed browser.
const playwrightHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
}
