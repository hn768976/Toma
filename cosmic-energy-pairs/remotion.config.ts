/**
 * Remotion CLI config. (Node.js render APIs ignore this file — pass the same
 * options directly there.)
 */
import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

// WebGL2 through ANGLE. On a GPU machine ANGLE uses the GPU; on a headless
// server without one it falls back to SwiftShader (slow but identical output).
Config.setChromiumOpenGlRenderer("angle");

// Lossless frames before encoding: JPEG intermediates add blocking/banding to
// dark gradients and lift pure black.
Config.setVideoImageFormat("png");
Config.setCodec("h264");
Config.setCrf(16);
Config.setPixelFormat("yuv420p");
Config.setColorSpace("bt709");
Config.setOverwriteOutput(true);

// Some sandboxed environments block downloading Remotion's Chrome Headless
// Shell but ship a Playwright one at this path. Elsewhere Remotion uses its
// own managed browser.
const playwrightHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
}
