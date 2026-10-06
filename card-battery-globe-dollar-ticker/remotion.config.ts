/**
 * Remotion CLI config. (The Node.js render APIs ignore this file — pass the
 * same options there directly.)
 */
import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

// Lossless intermediate frames: JPEG would add its own banding/blocking to the
// dark gradients before the H.264 encode.
Config.setVideoImageFormat("png");
Config.setOverwriteOutput(true);
// Every look is WebGL2. Headless Chromium must use ANGLE.
Config.setChromiumOpenGlRenderer("angle");
// Map rasterising + texture generation happen once per tab; give slow
// (software-GL) machines room.
Config.setDelayRenderTimeoutInMilliseconds(180000);
Config.setPixelFormat("yuv420p");
Config.setCodec("h264");
Config.setCrf(16);

// Sandboxed environments that block Remotion's own Chrome Headless Shell
// download but ship a Playwright Chromium: reuse it. On a normal machine this
// path does not exist and Remotion uses its managed browser.
const playwrightHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
}
