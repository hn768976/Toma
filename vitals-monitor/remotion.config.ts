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
// The scene is drawn with WebGL2. "angle" uses the GPU when there is one; on
// GPU-less machines/CI pass `--gl=swangle` (software) on the command line.
Config.setChromiumOpenGlRenderer("angle");
Config.setCodec("h264");

// Some sandboxed environments cannot download Remotion's Chrome Headless Shell but
// ship a Playwright one at this path. Use it when present; elsewhere Remotion falls
// back to downloading its own managed browser.
const playwrightHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
}
