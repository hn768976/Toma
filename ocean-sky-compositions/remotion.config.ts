/**
 * Note: When using the Node.JS APIs, the config file
 * doesn't apply. Instead, pass options directly to the APIs.
 *
 * All configuration options: https://remotion.dev/docs/config
 */

import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

Config.setRspack(true);
Config.setChromiumOpenGlRenderer("angle");
Config.setVideoImageFormat("png");
Config.setCodec("h264");
Config.setPixelFormat("yuv420p");
Config.setCrf(16);
Config.setOverwriteOutput(true);
// Software WebGL at 4K can take well over the default 30 s per frame on
// GPU-less machines, so allow generous per-frame time and fewer parallel tabs.
Config.setDelayRenderTimeoutInMilliseconds(600000);
Config.setConcurrency(2);

// Sandboxed environments that cannot download Remotion's Chrome Headless
// Shell may ship a Playwright build at this path. Use it if present;
// otherwise Remotion falls back to its own managed browser.
const playwrightHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
}
