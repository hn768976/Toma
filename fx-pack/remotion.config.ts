/**
 * CLI render defaults. All compositions are defined at 3840x2160 / 30fps.
 * See README.md for the per-clip render commands.
 */
import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("png");
Config.setPixelFormat("yuv420p");
Config.setCodec("h264");
Config.setChromiumOpenGlRenderer("angle");
Config.setOverwriteOutput(true);
Config.setConcurrency(2);

// Sandboxed environments that ship a Playwright Chromium: reuse it instead of
// downloading Remotion's managed headless shell. On a normal machine this path
// does not exist and Remotion uses its own browser.
const playwrightHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
}
