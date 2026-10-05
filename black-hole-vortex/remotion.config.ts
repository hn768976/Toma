import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

// PNG frames into the encoder: JPEG intermediates would add blocking to the
// smooth glows and defeat the dither.
Config.setVideoImageFormat("png");
Config.setOverwriteOutput(true);
Config.setPixelFormat("yuv420p");
Config.setCodec("h264");
Config.setCrf(16);

// WebGL2 in headless Chromium. "angle" is reliable on Linux/macOS/Windows; on a
// machine without a GPU ANGLE falls back to SwiftShader (slow but identical).
Config.setChromiumOpenGlRenderer("angle");

// Heavy raymarch shaders: give every frame plenty of time.
Config.setDelayRenderTimeoutInMilliseconds(600000);

// Sandboxed environments that block Remotion's own Chrome Headless Shell
// download but ship a Playwright Chromium: reuse it. Elsewhere this path does
// not exist and Remotion uses its managed browser.
const playwrightHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
}
