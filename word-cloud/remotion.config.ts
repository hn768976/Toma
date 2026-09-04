import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

Config.setRspack(true);
Config.setOverwriteOutput(true);
// PNG frames: the field is mostly black with very low-amplitude grain, and
// JPEG intermediates smear exactly that.
Config.setVideoImageFormat("png");
Config.setPixelFormat("yuv420p");
Config.setCodec("h264");
// No audio track at all. Remotion otherwise writes a silent one, which pads
// the container past 300 frames and puts a hiccup in an otherwise seamless
// loop.
Config.setMuted(true);
Config.setEnforceAudioTrack(false);

// Some sandboxed environments block downloading Remotion's own Chrome Headless
// Shell but ship a Playwright Chromium at this path. Reuse it there; on a
// normal machine the path won't exist and Remotion uses its managed browser.
const playwrightHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
}
