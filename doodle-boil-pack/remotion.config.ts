import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

// PNG frames: JPEG would put compression noise into the flat key colour.
Config.setVideoImageFormat("png");
Config.setOverwriteOutput(true);
Config.setPixelFormat("yuv420p");
Config.setCodec("h264");
Config.setCrf(16);

// Sandboxed environments may ship a Playwright headless shell instead of
// letting Remotion download its own. Elsewhere this path won't exist.
const playwrightHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
}
