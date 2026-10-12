import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

// WebGL2 through ANGLE. Required for the three.js (Looks 1-3) and PixiJS (Look 4)
// compositions in headless Chromium.
Config.setChromiumOpenGlRenderer("angle");

// Lossless intermediate frames: JPEG frames would add blocking to the dark
// gradients before the H.264 encode.
Config.setVideoImageFormat("png");
Config.setCodec("h264");
Config.setPixelFormat("yuv420p");
Config.setCrf(16);
Config.setOverwriteOutput(true);

// Some sandboxed environments block Remotion's own Chrome Headless Shell
// download but ship a Playwright one. Use it when present; elsewhere Remotion
// falls back to its managed browser.
const playwrightHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
}
