/**
 * Remotion CLI config. (Node.js render APIs ignore this file — pass the same
 * options directly if you script renders.)
 */
import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

// Looks 2-5 are WebGL2 (three.js). Headless Chromium needs ANGLE for WebGL.
// Equivalent CLI flag: --gl=angle
Config.setChromiumOpenGlRenderer("angle");

// PNG frames: lossless intermediate, no JPEG banding before the encoder.
Config.setVideoImageFormat("png");
Config.setPixelFormat("yuv420p");
Config.setCodec("h264");
Config.setCrf(16);
// Silent backgrounds: no audio stream in the output.
Config.setMuted(true);
Config.setOverwriteOutput(true);

// Long WebGL frames at 4K can take a while on CPU-only machines.
Config.setDelayRenderTimeoutInMilliseconds(300000);

// Sandboxed environments that ship a Playwright Chromium: reuse it instead of
// downloading Remotion's Chrome Headless Shell. Ignored on normal machines.
const playwrightHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
}
