import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

// WebGL2 through ANGLE. On a machine with a GPU, ANGLE uses it; in a
// headless container without one it falls back to SwiftShader.
Config.setChromiumOpenGlRenderer("angle");
// Lossless intermediate frames: JPEG would add blocking and banding on the
// soft backdrops before the H.264 encode.
Config.setVideoImageFormat("png");
Config.setCodec("h264");
Config.setPixelFormat("yuv420p");
Config.setCrf(16);
// No audio track in the output.
Config.setMuted(true);
Config.setOverwriteOutput(true);

// Some sandboxed environments block downloading Remotion's Chrome Headless
// Shell but ship a Playwright one. Use it when present; otherwise Remotion
// downloads its own.
const playwrightHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
}
