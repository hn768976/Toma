import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

// Lossless frames into the encoder so the key colour stays exact.
Config.setVideoImageFormat("png");
Config.setPixelFormat("yuv420p");
Config.setCodec("h264");
Config.setCrf(16);
Config.setMuted(true);
Config.setOverwriteOutput(true);

// Sandboxed environments that ship a Playwright headless shell can reuse it.
// On a normal machine this path doesn't exist and Remotion uses its own browser.
const playwrightHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
}
