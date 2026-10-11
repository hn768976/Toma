import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

// WebGL2 through ANGLE: the only GL backend that works reliably in headless Chromium.
Config.setChromiumOpenGlRenderer("angle");
// Lossless intermediate frames: JPEG frames add blocking and banding before H.264 sees them.
Config.setVideoImageFormat("png");
Config.setCodec("h264");
Config.setPixelFormat("yuv420p");
Config.setCrf(16);
Config.setOverwriteOutput(true);
// GPU-bound scenes: keep concurrency modest so each tab gets a full GL context.
Config.setConcurrency(2);
Config.setDelayRenderTimeoutInMilliseconds(120000);

// Some sandboxed environments block downloading Remotion's own headless shell but ship a
// Playwright Chromium here. On a normal machine this path doesn't exist and Remotion uses
// its default managed browser.
const playwrightHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
}
