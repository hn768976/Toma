import {existsSync} from "node:fs";
import {Config} from "@remotion/cli/config";

Config.setVideoImageFormat("png"); // lossless hand-off to the encoder: the
// grain is single-pixel, and a JPEG intermediate would smear it into the black.
Config.setStillImageFormat("png");
Config.setOverwriteOutput(true);
Config.setCodec("h264");
Config.setPixelFormat("yuv420p");
Config.setCrf(13);
// Picture-only plates: no silent AAC stream tacked on, so `ffprobe` reports a
// single video stream and the duration lands on exactly 20.00s.
Config.setMuted(true);
Config.setEnforceAudioTrack(false);
Config.setChromiumOpenGlRenderer("angle");

// Some sandboxed environments block Remotion's own Chrome Headless Shell
// download but ship a Playwright Chromium. Use it there; elsewhere this path
// does not exist and Remotion falls back to its managed browser.
const playwrightHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
}
