import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

// All looks are three.js on WebGL2. Headless Chromium needs ANGLE for WebGL2:
// on a GPU machine "angle" uses the GPU; on a GPU-less box ANGLE falls back to
// SwiftShader (identical pixels, just slower). Override per run with --gl=...
Config.setChromiumOpenGlRenderer("angle");
Config.setVideoImageFormat("png");
Config.setPixelFormat("yuv420p");
Config.setCodec("h264");
Config.setCrf(16);
Config.setOverwriteOutput(true);
Config.setDelayRenderTimeoutInMilliseconds(120000);

// Sandboxed CI boxes sometimes ship a Playwright headless shell and block the
// managed-browser download. Use it when present; otherwise Remotion's own.
const playwrightHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
}
