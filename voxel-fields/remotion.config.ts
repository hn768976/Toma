import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("png");
Config.setOverwriteOutput(true);
// WebGL2 in headless Chromium: ANGLE backend (uses the GPU when there is one,
// SwiftShader otherwise). Equivalent CLI flag: --gl=angle
Config.setChromiumOpenGlRenderer("angle");
Config.setCodec("h264");
Config.setPixelFormat("yuv420p");
Config.setCrf(16);

// Sandboxed environments that block Remotion's browser download but ship a
// Playwright Chromium headless shell: reuse it. Elsewhere this path won't exist
// and Remotion uses its own managed browser.
const pwShell = "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(pwShell)) {
  Config.setBrowserExecutable(pwShell);
}
