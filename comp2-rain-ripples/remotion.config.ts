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
// CRF 18: visually transparent at 1080p while keeping the high-entropy
// water texture under ~100 MB per 30 s file.
Config.setCrf(18);
// WebGL shader compile + 4K float buffers can be slow on software GL.
Config.setTimeoutInMilliseconds(300000);

// Optional: some sandboxed environments block downloading Remotion's own
// Chrome Headless Shell but ship a Playwright one. Use it if present;
// on a normal machine Remotion downloads and uses its managed browser.
const playwrightHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell";
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
}
