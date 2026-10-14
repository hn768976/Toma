import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

// WebGL2 through ANGLE. Required for three.js / PixiJS in headless Chromium.
Config.setChromiumOpenGlRenderer("angle");
Config.setVideoImageFormat("png");
Config.setPixelFormat("yuv420p");
Config.setCodec("h264");
Config.setCrf(16);
Config.setOverwriteOutput(true);
// Large GPU/CPU frames: give each frame more time than the 30s default.
Config.setDelayRenderTimeoutInMilliseconds(120000);

// Sandboxed environments without Remotion's managed headless shell can point
// at a local one; on a normal machine this path doesn't exist and Remotion
// uses its own browser.
const localShell = "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(localShell)) {
  Config.setBrowserExecutable(localShell);
}
