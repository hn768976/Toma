/**
 * Remotion CLI config. (When using the Node.js render APIs, pass these
 * options directly instead.)
 */
import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("png");
Config.setOverwriteOutput(true);
// WebGL2 through ANGLE. Works on GPU machines and falls back to SwiftShader
// in headless sandboxes. Never use "swangle"/"egl" here: they have produced
// black frames on some Linux hosts.
Config.setChromiumOpenGlRenderer("angle");
Config.setPixelFormat("yuv420p");
Config.setCodec("h264");
Config.setCrf(16);
// Each WebGL frame is heavy; a long timeout keeps 4K/6K renders safe.
Config.setDelayRenderTimeoutInMilliseconds(120000);

// Sandboxed CI boxes sometimes block Remotion's own Chrome Headless Shell
// download but ship a Playwright Chromium. Reuse it when present; on a normal
// machine this path doesn't exist and Remotion uses its managed browser.
const playwrightHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
}
