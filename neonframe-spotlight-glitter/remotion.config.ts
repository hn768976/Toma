import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("png");
Config.setOverwriteOutput(true);
Config.setCodec("h264");
Config.setPixelFormat("yuv420p");
Config.setCrf(16);
// WebGL2 in headless Chromium needs ANGLE. Also pass on the command line:
//   --gl=angle   (GPU machine)   or   --gl=swangle  (CPU-only / no GPU, SwiftShader)
Config.setChromiumOpenGlRenderer("angle");

// Sandboxed environments ship a Playwright headless shell; reuse it if present.
const pw = "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(pw)) {
  Config.setBrowserExecutable(pw);
}
