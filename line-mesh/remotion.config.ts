import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

// PNG intermediates, not JPEG: the cloth's dark falloff is exactly where JPEG
// chroma subsampling and quantisation would show, and the render here is
// CPU-bound on the vertex shader anyway, so the extra encode costs little.
Config.setVideoImageFormat("png");
Config.setPixelFormat("yuv420p");
// Without an explicit colour space the full-range PNG/JPEG frames get tagged
// yuvj420p, which players interpret inconsistently.
Config.setColorSpace("bt709");
// Nothing here makes a sound; don't attach a silent AAC track.
Config.setMuted(true);
Config.setEnforceAudioTrack(false);
Config.setOverwriteOutput(true);

// Headless Chromium must run WebGL through ANGLE for @remotion/three to work.
Config.setChromiumOpenGlRenderer("angle");

// Some sandboxed environments block downloading Remotion's own Chrome Headless
// Shell but ship a Playwright Chromium. Reuse it there; on a normal machine
// this path does not exist and Remotion falls back to its managed browser.
const playwrightHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
}
