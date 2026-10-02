/**
 * Remotion CLI config. (Node.js render APIs ignore this file; pass the same
 * options directly there.)
 */
import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

// WebGL2 through ANGLE. Required for looks 1–5 in headless Chromium.
Config.setChromiumOpenGlRenderer("angle");

// Lossless intermediate frames so dark gradients don't band before encoding.
Config.setVideoImageFormat("png");
Config.setCodec("h264");
Config.setPixelFormat("yuv420p");
Config.setCrf(16);
Config.setOverwriteOutput(true);
Config.setConcurrency(1);

// Sandboxed environments that ship a Playwright Chromium: reuse it rather
// than downloading Remotion's Chrome Headless Shell. On other machines the
// path doesn't exist and Remotion uses its own browser.
const playwrightHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
}
