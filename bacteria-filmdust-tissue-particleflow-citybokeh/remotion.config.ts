import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

Config.setEntryPoint("./src/index.ts");
// PixiJS 8 runs on WebGL2. Headless Chromium needs ANGLE for a WebGL2 context.
Config.setChromiumOpenGlRenderer("angle");
Config.setVideoImageFormat("png");
Config.setPixelFormat("yuv420p");
Config.setCodec("h264");
Config.setCrf(16);
Config.setOverwriteOutput(true);
Config.setDelayRenderTimeoutInMilliseconds(600000);

// Some sandboxed environments block downloading Remotion's Chrome Headless
// Shell but ship a Playwright one; use it when present. Elsewhere this path
// does not exist and Remotion uses its own managed browser.
const playwrightHeadlessShell = "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
}
