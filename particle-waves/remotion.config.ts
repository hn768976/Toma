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
Config.setCodec("h264");
Config.setPixelFormat("yuv420p");
Config.setCrf(16);
// WebGL 2 needs a GL backend in headless Chrome. "angle" uses the GPU when
// one exists; on GPU-less machines pass --gl=swangle on the command line.
Config.setChromiumOpenGlRenderer("angle");

// Some sandboxed environments block downloading Remotion's Chrome Headless
// Shell but ship a Playwright one here; elsewhere this path doesn't exist and
// Remotion uses its own managed browser.
const playwrightHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
}
