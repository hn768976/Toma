import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

// three.js on WebGL2. Headless Chromium needs ANGLE for a WebGL2 context
// (equivalent to passing --gl=angle on the CLI).
Config.setChromiumOpenGlRenderer("angle");
Config.setVideoImageFormat("png");
Config.setPixelFormat("yuv420p");
Config.setCodec("h264");
Config.setCrf(16);
Config.setOverwriteOutput(true);
Config.setTimeoutInMilliseconds(240000);

// Some sandboxed environments block downloading Remotion's Chrome Headless
// Shell but ship a Playwright build at this path. Elsewhere this path won't
// exist and Remotion uses its own managed browser.
const playwrightHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
}
