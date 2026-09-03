import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
// The piece has no audio; without this Remotion attaches a silent track.
Config.setMuted(true);
Config.setEnforceAudioTrack(false);

// Some sandboxed environments block downloading Remotion's own Chrome
// Headless Shell but ship a Playwright Chromium. Use it when present; on a
// normal machine this path won't exist and Remotion falls back to its
// default managed browser.
const playwrightHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
}
