import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("png");
Config.setOverwriteOutput(true);
Config.setCodec("h264");
Config.setPixelFormat("yuv420p");
Config.setCrf(16);
// These are silent loops: no audio track at all, not a silent one.
Config.setMuted(true);
Config.setEnforceAudioTrack(false);
// SwiftShader-backed ANGLE: the only renderer that works in headless Chromium
// without a GPU. On a GPU machine, switch this to "angle".
Config.setChromiumOpenGlRenderer("swangle");

// Some sandboxed environments block Remotion's own Chrome Headless Shell
// download but ship a Playwright Chromium. Reuse it when it is there.
const playwrightHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
}
