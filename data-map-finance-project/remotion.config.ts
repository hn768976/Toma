/**
 * Remotion CLI config. (Node.js render APIs ignore this file; pass the same
 * options there directly.)
 */
import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

// WebGL2 through ANGLE. Required for the three.js looks in headless Chromium.
Config.setChromiumOpenGlRenderer("angle");
// PNG frames: lossless intermediate, no JPEG banding in dark gradients.
Config.setVideoImageFormat("png");
Config.setPixelFormat("yuv420p");
Config.setCodec("h264");
Config.setCrf(16);
Config.setOverwriteOutput(true);

// Sandboxed environments sometimes block Remotion's Chrome Headless Shell
// download but ship Playwright's. Use it when present; on a normal machine this
// path does not exist and Remotion uses its own managed browser.
const playwrightHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
}
