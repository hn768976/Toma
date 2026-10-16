import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

// WebGL2 through ANGLE is the reliable GL path in headless Chromium.
Config.setChromiumOpenGlRenderer("angle");
// Lossless PNG frames go to the encoder (no JPEG pass before H.264).
Config.setVideoImageFormat("png");
Config.setCodec("h264");
Config.setPixelFormat("yuv420p");
Config.setCrf(16);
Config.setOverwriteOutput(true);

// Sandboxed machines that block Remotion's own browser download but ship a
// Playwright headless shell: reuse it. Elsewhere this path doesn't exist and
// Remotion uses its managed Chrome Headless Shell.
const playwrightHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
}
