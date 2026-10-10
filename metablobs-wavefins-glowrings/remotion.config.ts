import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

// WebGL2 in headless Chromium: ANGLE. (CLI equivalent: --gl=angle)
Config.setChromiumOpenGlRenderer("angle");

Config.setVideoImageFormat("png");
Config.setCodec("h264");
Config.setPixelFormat("yuv420p");
Config.setCrf(16);
Config.setOverwriteOutput(true);
// The shaders are heavy and the GPU is shared between tabs; more tabs rarely help.
Config.setConcurrency(1);
Config.setDelayRenderTimeoutInMilliseconds(600000);

// Sandboxed CI images sometimes ship a Playwright headless shell instead of
// letting Remotion download its own; use it when present, otherwise Remotion
// falls back to its managed Chrome Headless Shell.
const playwrightHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
}
