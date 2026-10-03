import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

// WebGL2 through ANGLE — required for three.js in headless Chromium.
Config.setChromiumOpenGlRenderer("angle");
// PNG frames into the encoder: lossless intermediate, no JPEG blocking in gradients.
Config.setVideoImageFormat("png");
Config.setPixelFormat("yuv420p");
Config.setCodec("h264");
Config.setOverwriteOutput(true);
// Each WebGL context is heavy; keep concurrency modest.
Config.setConcurrency(2);

// Sandboxed environments that block Remotion's Chrome download but ship
// Playwright's headless shell. On a normal machine this path doesn't exist and
// Remotion uses its own managed browser.
const playwrightHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
}
