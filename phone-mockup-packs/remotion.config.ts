import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

// PNG intermediates: JPEG would smear the #00FF00 screens before encoding.
Config.setVideoImageFormat("png");
Config.setChromiumOpenGlRenderer("angle");
Config.setCodec("h264");
Config.setPixelFormat("yuv420p");
Config.setCrf(16);
Config.setColorSpace("bt709");
Config.setOverwriteOutput(true);

// Sandboxed environments that cannot download Remotion's headless shell can
// reuse a preinstalled Playwright one. Elsewhere this path doesn't exist and
// Remotion uses its own managed browser.
const playwrightHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
}
