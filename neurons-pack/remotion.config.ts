/**
 * CLI config. The Node APIs ignore this file; pass the same options there.
 * All options: https://remotion.dev/docs/config
 */
import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

// PNG frames: JPEG would lift the exact black / white / #00FF00 levels.
Config.setVideoImageFormat("png");
Config.setOverwriteOutput(true);
// WebGL2 through ANGLE (SwiftShader when there is no GPU).
Config.setChromiumOpenGlRenderer("angle");
Config.setCodec("h264");
Config.setPixelFormat("yuv420p");
Config.setCrf(16);

// Sandboxed environments that block Remotion's Chrome Headless Shell
// download ship a Playwright build here; elsewhere Remotion's own is used.
const playwrightHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
}
