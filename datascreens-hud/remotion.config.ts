import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

// WebGL2 via ANGLE. On a GPU-less machine Chromium falls back to SwiftShader.
Config.setChromiumOpenGlRenderer("angle");
Config.setVideoImageFormat("png");
Config.setCodec("h264");
Config.setPixelFormat("yuv420p");
Config.setCrf(16);
Config.setMuted(true); // no audio stream
Config.setOverwriteOutput(true);

// Sandboxed dev boxes that can't download Remotion's headless shell ship a
// Playwright one here. On a normal machine this path doesn't exist and
// Remotion uses its own managed browser.
const playwrightHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
}
