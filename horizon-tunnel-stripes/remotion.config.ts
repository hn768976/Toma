// Remotion CLI config. Options passed on the command line override these.
// All options: https://remotion.dev/docs/config
import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

// three.js needs a real WebGL2 context in headless Chromium.
// ANGLE works on GPU machines and falls back to SwiftShader on CPU-only ones.
Config.setChromiumOpenGlRenderer("angle");

// Lossless frames into the encoder: avoids JPEG blocking in soft gradients.
Config.setVideoImageFormat("png");
Config.setCodec("h264");
Config.setPixelFormat("yuv420p");
Config.setCrf(16);
Config.setOverwriteOutput(true);
// Silent backgrounds: no audio stream in the output.
Config.setMuted(true);
Config.setDelayRenderTimeoutInMilliseconds(120000);

// Some sandboxed environments block downloading Remotion's Chrome Headless
// Shell but ship a Playwright one; use it if present. On a normal machine
// this path does not exist and Remotion uses its own browser.
const playwrightHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
}
