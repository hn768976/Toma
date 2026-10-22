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
// Tag BT.709 and encode limited ("TV") range — the standard for HD delivery.
Config.setColorSpace("bt709");
Config.setCrf(16);
// Software ANGLE works on machines without a GPU (CI, containers) and keeps
// the WebGL 2 shader output identical everywhere.
Config.setChromiumOpenGlRenderer("swangle");

// Some sandboxed environments block downloading Remotion's Chrome Headless
// Shell but ship a Playwright Chromium here; reuse it when present.
const playwrightHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
}
