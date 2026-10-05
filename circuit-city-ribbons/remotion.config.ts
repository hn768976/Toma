/**
 * Remotion CLI config. Applies to `npx remotion studio|render|still`.
 * All configuration options: https://remotion.dev/docs/config
 */
import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("png");
Config.setOverwriteOutput(true);
Config.setCodec("h264");
Config.setPixelFormat("yuv420p");
Config.setCrf(16);
Config.setMuted(true);

// WebGL2 in headless Chromium: use ANGLE (equivalent to `--gl=angle`).
Config.setChromiumOpenGlRenderer("angle");

// Sandboxed environments that cannot download Remotion's Chrome Headless Shell
// may ship a Playwright one here. On a normal machine this path does not exist
// and Remotion uses its own managed browser.
const playwrightHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
}
