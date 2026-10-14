import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

// WebGL2 in headless Chromium: ANGLE is the reliable backend (also --gl=angle on the CLI).
Config.setChromiumOpenGlRenderer("angle");
Config.setVideoImageFormat("png");
Config.setPixelFormat("yuv420p");
Config.setCodec("h264");
Config.setOverwriteOutput(true);
// Each WebGL tab is heavy; keep a modest default. Override with --concurrency.
Config.setConcurrency(2);
Config.setDelayRenderTimeoutInMilliseconds(120000);

// Sandboxed environments that cannot download Remotion's Chrome Headless Shell
// can point at a preinstalled one. On a normal machine this path doesn't exist
// and Remotion uses its own managed browser.
const preinstalledShell =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(preinstalledShell)) {
  Config.setBrowserExecutable(preinstalledShell);
}
