import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("png");
Config.setOverwriteOutput(true);
// WebGL2 in headless Chromium: render through ANGLE.
Config.setChromiumOpenGlRenderer("angle");
// One WebGL context per tab is heavy on CPU-only machines; keep it modest.
Config.setConcurrency(2);
Config.setCodec("h264");
Config.setPixelFormat("yuv420p");
Config.setCrf(16);

// Some sandboxed environments block downloading Remotion's Chrome Headless
// Shell but ship a Playwright Chromium; reuse it when present.
const playwrightHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
}
