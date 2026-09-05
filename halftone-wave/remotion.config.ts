import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

Config.setRspack(true);
Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
Config.setChromiumOpenGlRenderer("angle");

// H.264 / yuv420p, bt709, and no silent audio track: these are background
// loops with no sound. The colour space matters — without it the jpeg frame
// pipeline tags the output full range (yuvj420p), which some players read as
// crushed blacks.
Config.setCodec("h264");
Config.setPixelFormat("yuv420p");
Config.setColorSpace("bt709");
Config.setMuted(true);

// Some sandboxed environments block downloading Remotion's own Chrome
// Headless Shell but ship a Playwright Chromium. Reuse it when it is
// present; on a normal machine this path won't exist and Remotion falls
// back to its default managed browser.
const playwrightHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
}
