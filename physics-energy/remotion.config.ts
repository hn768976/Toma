import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

// WebGL2 through ANGLE. On a GPU machine this uses the GPU; in a container
// without one Chromium falls back to SwiftShader behind ANGLE.
Config.setChromiumOpenGlRenderer("angle");
Config.setVideoImageFormat("png");
Config.setPixelFormat("yuv420p");
Config.setCodec("h264");
Config.setCrf(16);
Config.setOverwriteOutput(true);

// Some sandboxed environments block Remotion's Chrome Headless Shell download
// but ship a Playwright Chromium here. Elsewhere this path doesn't exist and
// Remotion uses its own managed browser.
const pw = "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(pw)) {
  Config.setBrowserExecutable(pw);
}
