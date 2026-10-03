import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

// PNG frames: JPEG would smear the anti-banding grain before encoding.
Config.setVideoImageFormat("png");
Config.setOverwriteOutput(true);
Config.setCodec("h264");
Config.setPixelFormat("yuv420p");
Config.setCrf(16);
Config.setMuted(true);

// Sandboxed environments that ship a Playwright Chromium headless shell can
// reuse it instead of downloading Remotion's; elsewhere this path won't
// exist and Remotion uses its own managed browser.
const playwrightHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
}
