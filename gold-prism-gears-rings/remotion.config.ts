import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

// Lossless frames into the encoder: JPEG intermediates would add blocking and
// banding to the soft gradients these looks are made of.
Config.setVideoImageFormat("png");
Config.setCodec("h264");
Config.setPixelFormat("yuv420p");
Config.setCrf(16);
Config.setOverwriteOutput(true);
// WebGL2 in headless Chromium.
Config.setChromiumOpenGlRenderer("angle");
// Software WebGL needs time on the first frame of each tab (shader compile, HDRI).
Config.setDelayRenderTimeoutInMilliseconds(240000);

// Sandboxed environments that cannot download Remotion's Chrome Headless Shell
// often ship a Playwright one; use it if present, otherwise Remotion's default.
const playwrightHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
}
