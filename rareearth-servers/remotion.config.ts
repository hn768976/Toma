import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

// three.js on WebGL2. Headless Chromium needs ANGLE for a WebGL2 context.
Config.setChromiumOpenGlRenderer("angle");
Config.setVideoImageFormat("png");
Config.setPixelFormat("yuv420p");
Config.setCodec("h264");
Config.setCrf(16);
Config.setOverwriteOutput(true);
// WebGL frames are heavy: a single tab per thread avoids GPU-context contention.
Config.setConcurrency(1);
Config.setTimeoutInMilliseconds(240000);

// Sandboxes that cannot download Remotion's headless shell can ship a
// Playwright one here. On a normal machine this path does not exist and
// Remotion uses its own managed browser.
const playwrightHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
}
