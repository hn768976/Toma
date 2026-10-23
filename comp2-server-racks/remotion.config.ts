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
Config.setCodec("h264");
Config.setPixelFormat("yuv420p");
Config.setOverwriteOutput(true);
Config.setChromiumOpenGlRenderer("angle");
// Without a GPU, WebGL falls back to software rendering and a full 3840x2160
// frame (scene + depth pass + bokeh + bloom) can take well over 30 s.
Config.setDelayRenderTimeoutInMilliseconds(600000);
Config.setDefaultPremountInSeconds(2);

// Some sandboxed environments block downloading Remotion's Chrome Headless
// Shell but ship a Playwright one at this path. Reuse it when present;
// elsewhere Remotion falls back to its default managed browser.
const playwrightHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
}
