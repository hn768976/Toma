import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

// WebGL2 in headless Chromium. "angle" is the flag to use on any machine with a GPU.
// On a GPU-less box (CI, containers) ANGLE falls back to SwiftShader automatically.
Config.setChromiumOpenGlRenderer("angle");
Config.setVideoImageFormat("png");
Config.setPixelFormat("yuv420p");
Config.setCodec("h264");
Config.setCrf(16);
Config.setOverwriteOutput(true);
// Large WebGL scenes need time on software GL for the first frame (shader compile, layout).
Config.setDelayRenderTimeoutInMilliseconds(300000);

// Sandboxed environments that cannot download Remotion's Chrome Headless Shell
// may ship a Playwright headless shell here; elsewhere Remotion uses its own browser.
const playwrightHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
}
