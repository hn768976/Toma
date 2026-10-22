/**
 * Note: When using the Node.JS APIs, the config file
 * doesn't apply. Instead, pass options directly to the APIs.
 *
 * All configuration options: https://remotion.dev/docs/config
 */

import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

Config.setRspack(true);
// WebGL 2 is required; ANGLE gives a working GL context in headless Chrome
// with or without a GPU.
Config.setChromiumOpenGlRenderer("angle");
Config.setVideoImageFormat("png");
Config.setOverwriteOutput(true);
Config.setCodec("h264");
Config.setPixelFormat("yuv420p");
Config.setCrf(16);
// Each frame is very GPU-heavy at 4K; give slow software-GL machines time.
Config.setDelayRenderTimeoutInMilliseconds(120000);

// Some sandboxed environments block downloading Remotion's own Chrome
// Headless Shell but ship a Playwright one. Use it when present; on a
// normal machine this path won't exist and Remotion downloads its browser.
const playwrightHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
}
