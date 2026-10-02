import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("png");
Config.setOverwriteOutput(true);
Config.setCodec("h264");
Config.setPixelFormat("yuv420p");
Config.setCrf(16);

// Sandboxed environments that block Remotion's managed Chrome download can
// point at a preinstalled headless shell. On a normal machine this path does
// not exist and Remotion uses its own browser.
const preinstalledShell =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(preinstalledShell)) {
  Config.setBrowserExecutable(preinstalledShell);
}
