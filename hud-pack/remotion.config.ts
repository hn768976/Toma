import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

// WebGL2 through ANGLE. Required for headless Chromium (three.js / shaders).
Config.setChromiumOpenGlRenderer("angle");
// Lossless frames into the encoder: the dark gradients band if frames go through JPEG.
Config.setVideoImageFormat("png");
Config.setPixelFormat("yuv420p");
Config.setCodec("h264");
Config.setCrf(16);
Config.setOverwriteOutput(true);
// Every frame is a full WebGL render; give slow software GL plenty of time.
Config.setDelayRenderTimeoutInMilliseconds(120000);

// Sandboxed environments that cannot download Remotion's Chrome Headless Shell
// but ship a Playwright Chromium: reuse it. Elsewhere this path does not exist
// and Remotion uses its own managed browser.
const playwrightHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
}
