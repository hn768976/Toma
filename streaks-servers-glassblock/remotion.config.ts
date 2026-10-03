/**
 * Remotion CLI config. (The Node.js render APIs ignore this file — pass the
 * same options directly there.)
 */
import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

// WebGL2 in headless Chromium: ANGLE is the reliable backend (falls back to
// SwiftShader on machines without a GPU). Same as `--gl=angle` on the CLI.
Config.setChromiumOpenGlRenderer("angle");

// Lossless intermediate frames: JPEG intermediates add blocking and banding
// on the smooth gradients before the H.264 encode.
Config.setVideoImageFormat("png");
Config.setCodec("h264");
Config.setPixelFormat("yuv420p");
Config.setCrf(16);
Config.setOverwriteOutput(true);

// Some sandboxed environments block downloading Remotion's own Chrome
// Headless Shell but ship a Playwright one here. On a normal machine this
// path does not exist and Remotion uses its managed browser.
const playwrightHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
}
