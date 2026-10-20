import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("png");
Config.setOverwriteOutput(true);
Config.setChromiumOpenGlRenderer("angle");

// Sandboxed environments that can't download Remotion's headless shell ship a Playwright one here.
const shell = "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(shell)) {
  Config.setBrowserExecutable(shell);
}
