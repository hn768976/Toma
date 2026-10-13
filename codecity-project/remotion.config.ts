import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

// WebGL2 through ANGLE. Headless Chromium has no GL without this flag.
Config.setChromiumOpenGlRenderer("angle");
Config.setVideoImageFormat("png");
Config.setPixelFormat("yuv420p");
Config.setCodec("h264");
Config.setCrf(16);
Config.setOverwriteOutput(true);

// Sandboxed environments that block Remotion's browser download but ship a
// Playwright headless shell: reuse it. Elsewhere Remotion uses its own.
const pw = "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(pw)) {
  Config.setBrowserExecutable(pw);
}
