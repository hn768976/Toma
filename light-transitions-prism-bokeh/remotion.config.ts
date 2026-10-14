import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

// PixiJS 8 on WebGL2. Headless Chromium needs ANGLE for a working WebGL2
// context (it falls back to SwiftShader when there is no GPU).
Config.setChromiumOpenGlRenderer("angle");
// Lossless frames into the encoder: JPEG intermediates would band the gradients.
Config.setVideoImageFormat("png");
Config.setPixelFormat("yuv420p");
Config.setCodec("h264");
Config.setCrf(16);
Config.setOverwriteOutput(true);

// Sandboxes that cannot download Remotion's Chrome Headless Shell may ship a
// Playwright one; use it if present, otherwise Remotion's default applies.
const playwrightHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
}
