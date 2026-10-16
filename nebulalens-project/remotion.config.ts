/**
 * Remotion CLI config. (The Node.js render APIs ignore this file; pass the same
 * options there directly.)
 */
import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

// WebGL2 through ANGLE. This is what makes WebGL2 + half-float render targets
// reliable in headless Chromium (on a GPU-less machine ANGLE falls back to
// SwiftShader). Equivalent to passing --gl=angle on the command line.
Config.setChromiumOpenGlRenderer("angle");

// PNG intermediates: lossless frames avoid JPEG blocking in the gradients.
Config.setVideoImageFormat("png");
Config.setPixelFormat("yuv420p");
Config.setCodec("h264");
Config.setCrf(16);
Config.setOverwriteOutput(true);

// 4K shader frames can take several seconds on a CPU (SwiftShader) renderer.
Config.setDelayRenderTimeoutInMilliseconds(300000);

// Some sandboxed environments block downloading Remotion's Chrome Headless
// Shell but ship a Playwright one here. Elsewhere this path won't exist and
// Remotion uses its own managed browser.
const playwrightHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
}
