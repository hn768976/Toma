/**
 * Remotion CLI config. (Node.js render APIs ignore this file - pass the same
 * options there.)
 */
import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("png");
Config.setOverwriteOutput(true);
Config.setPixelFormat("yuv420p");
Config.setCodec("h264");
Config.setCrf(16);

// WebGL2 through ANGLE. On a machine with a GPU this uses it; on a headless
// box without one, pass `--gl=swangle` (ANGLE on SwiftShader) instead.
Config.setChromiumOpenGlRenderer("angle");

// Some sandboxed environments block downloading Remotion's own Chrome
// Headless Shell but ship a Playwright one. Reuse it if present; on a normal
// machine this path doesn't exist and Remotion uses its managed browser.
const playwrightHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
}
