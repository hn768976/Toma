import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

// WebGL2 in headless Chromium goes through ANGLE.
// On a machine with a GPU use "angle"; with no GPU (CI containers) use "swangle"
// (ANGLE on top of SwiftShader). Override per render with --gl=<value>.
Config.setChromiumOpenGlRenderer("angle");
Config.setVideoImageFormat("png");
Config.setPixelFormat("yuv420p");
Config.setCodec("h264");
Config.setCrf(16);
Config.setOverwriteOutput(true);
Config.setConcurrency(null);
Config.setDelayRenderTimeoutInMilliseconds(120000);

// Sandboxed environments that cannot download Remotion's Chrome Headless Shell
// can reuse a Playwright one; on a normal machine this path does not exist.
const playwrightHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
}
