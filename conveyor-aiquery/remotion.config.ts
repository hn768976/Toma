import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("png");
Config.setOverwriteOutput(true);
// WebGL2 through ANGLE. Headless Chromium needs this flag (equivalent to
// `--gl=angle` on the CLI). WebGPU is not used.
Config.setChromiumOpenGlRenderer("angle");
Config.setCodec("h264");
Config.setPixelFormat("yuv420p");
Config.setCrf(16);
Config.setTimeoutInMilliseconds(240000);

// Sandboxed environments that cannot download Remotion's Chrome Headless
// Shell may ship a Playwright Chromium here; on a normal machine this path
// does not exist and Remotion uses its own managed browser.
const pw = "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(pw)) {
  Config.setBrowserExecutable(pw);
}
