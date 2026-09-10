import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

Config.setEntryPoint("./src/index.ts");
Config.setOverwriteOutput(true);
Config.setVideoImageFormat("jpeg");
// The nebula is a long, dark gradient; a low-quality intermediate would band
// before the encoder ever got a chance to.
Config.setJpegQuality(95);
Config.setCodec("h264");
Config.setPixelFormat("yuv420p");
Config.setCrf(16);
// Stock delivery: picture only, no silent audio track riding along.
Config.setMuted(true);
Config.setEnforceAudioTrack(false);
Config.setColorSpace("bt709");
Config.setChromiumOpenGlRenderer("angle");

// Some sandboxed environments block Remotion's own Chrome Headless Shell
// download but ship a Playwright Chromium. Use it there; elsewhere this path
// does not exist and Remotion falls back to its managed browser.
const playwrightHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
}
