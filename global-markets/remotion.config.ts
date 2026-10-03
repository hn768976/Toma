import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("png");
Config.setOverwriteOutput(true);
Config.setPixelFormat("yuv420p");
Config.setCodec("h264");
Config.setCrf(16);
// WebGL2 in headless Chromium (look 1). Required.
Config.setChromiumOpenGlRenderer("angle");

// Sandboxed environments that block downloading Remotion's Chrome Headless
// Shell but ship a Playwright one: reuse it. Elsewhere this path does not exist
// and Remotion uses its own managed browser.
const playwrightHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
}
