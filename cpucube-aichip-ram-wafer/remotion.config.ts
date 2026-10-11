import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

// WebGL2 through ANGLE — reliable in headless Chromium.
Config.setChromiumOpenGlRenderer("angle");
Config.setVideoImageFormat("png");
Config.setOverwriteOutput(true);
Config.setPixelFormat("yuv420p");
Config.setCodec("h264");
Config.setCrf(16);
Config.setConcurrency(1);
Config.setDelayRenderTimeoutInMilliseconds(120000);

// Sandboxed environments that block Remotion's Chrome download but ship a
// Playwright headless shell: reuse it. Elsewhere this path is absent and
// Remotion uses its own managed browser.
const shell = "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(shell)) {
  Config.setBrowserExecutable(shell);
}
