/**
 * Remotion CLI config. three.js runs on WebGL2; headless Chromium needs the
 * ANGLE GL backend for that (`--gl=angle` on the command line, set here too).
 */
import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

Config.setChromiumOpenGlRenderer("angle");
Config.setVideoImageFormat("png");
Config.setOverwriteOutput(true);
Config.setPixelFormat("yuv420p");
Config.setCodec("h264");
Config.setMuted(true);

// Sandboxed CI images sometimes ship a Playwright headless shell instead of
// letting Remotion download its own. Use it when present; elsewhere Remotion
// falls back to its managed browser.
const playwrightHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
}
