import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

// PixiJS 8 on WebGL2. In headless Chromium WebGL needs the ANGLE backend.
Config.setChromiumOpenGlRenderer("angle");
// Lossless frames into the encoder: JPEG intermediates would add blocking and
// banding to these gradient-heavy backgrounds.
Config.setVideoImageFormat("png");
Config.setPixelFormat("yuv420p");
Config.setCodec("h264");
Config.setCrf(16);
Config.setOverwriteOutput(true);

// Sandboxed environments that ship a Playwright headless shell reuse it
// instead of downloading one; elsewhere Remotion's managed browser is used.
const playwrightHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
}
