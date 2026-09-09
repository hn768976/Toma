import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("png");
Config.setOverwriteOutput(true);
Config.setPixelFormat("yuv420p");
Config.setCodec("h264");
// These compositions carry no audio. Without this Remotion muxes a silent AAC
// track, which also stretches the container past 20.000s.
Config.setMuted(true);
Config.setEnforceAudioTrack(false);
Config.setChromiumOpenGlRenderer("angle");

// Some sandboxed environments block Remotion's own Chrome Headless Shell
// download but ship a Playwright Chromium. Reuse it when it is there; on a
// normal machine this path does not exist and Remotion uses its own browser.
const playwrightShell =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(playwrightShell)) {
  Config.setBrowserExecutable(playwrightShell);
}
