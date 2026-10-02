import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

// WebGL2 in headless Chromium. "angle" works with and without a GPU
// (falls back to SwiftShader on GPU-less machines).
Config.setChromiumOpenGlRenderer("angle");

// PNG frames into the encoder: JPEG intermediates would add blocking in
// the dark gradients these looks are made of.
Config.setVideoImageFormat("png");
Config.setCodec("h264");
Config.setPixelFormat("yuv420p");
Config.setCrf(16);
Config.setOverwriteOutput(true);
Config.setEntryPoint("./src/index.ts");

// Sandboxed CI images sometimes ship a Playwright headless shell instead of
// letting Remotion download its own. Use it when present.
const playwrightHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
}
