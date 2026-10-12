import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

// Frames are captured as PNG so the chroma green is never touched by JPEG.
Config.setVideoImageFormat("png");
Config.setOverwriteOutput(true);
// WebGL2 through ANGLE: reliable in headless Chromium (equivalent to --gl=angle).
Config.setChromiumOpenGlRenderer("angle");
Config.setCodec("h264");
Config.setPixelFormat("yuv420p");
Config.setCrf(16);

// Some sandboxed environments block downloading Remotion's Chrome Headless
// Shell but ship a Playwright Chromium. Use it when present; elsewhere
// Remotion falls back to its own managed browser.
const playwrightHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
}
