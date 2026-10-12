import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

// Every frame is a self-contained WebGL2 render, so PNG frames avoid an
// extra lossy JPEG step before the H.264 encode (keeps dark gradients clean).
Config.setVideoImageFormat("png");
Config.setOverwriteOutput(true);
Config.setCodec("h264");
Config.setPixelFormat("yuv420p");
Config.setCrf(16);

// WebGL2 in headless Chromium: ANGLE is the reliable backend.
Config.setChromiumOpenGlRenderer("angle");

// Some sandboxed environments ship a Playwright headless shell instead of
// letting Remotion download its own. Use it when present.
const playwrightHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
}
