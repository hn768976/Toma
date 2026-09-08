import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

// PNG intermediates, not JPEG: the JPEG path hands the encoder full-range
// frames and the mp4 comes out tagged yuvj420p. PNG gives a clean, limited
// range yuv420p, which is what a stock clip is expected to carry.
Config.setVideoImageFormat("png");
Config.setColorSpace("bt709");
// No audio in this piece; without this the mp4 carries a silent AAC track.
Config.setMuted(true);
Config.setEnforceAudioTrack(false);
Config.setOverwriteOutput(true);
Config.setChromiumOpenGlRenderer("angle");

// Some sandboxed dev environments block downloading Remotion's own Chrome
// Headless Shell but ship a Playwright Chromium at this path. Reuse it there;
// on a normal machine this path won't exist and Remotion falls back to its
// own managed browser.
const playwrightHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
}
