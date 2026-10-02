import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

Config.setEntryPoint("src/index.ts");
// WebGL2 in headless Chromium for the @remotion/three particle layer.
Config.setChromiumOpenGlRenderer("angle");
// Lossless intermediate frames: JPEG would add blocking to the gradient.
Config.setVideoImageFormat("png");
Config.setCodec("h264");
Config.setPixelFormat("yuv420p");
Config.setCrf(16);
Config.setOverwriteOutput(true);
Config.setMuted(true);

// Sandboxed environments that cannot download Remotion's headless shell but
// ship a Playwright Chromium: reuse it. Elsewhere this path does not exist and
// Remotion uses its own managed browser.
const playwrightHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
}
