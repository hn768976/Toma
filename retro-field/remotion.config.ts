import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

// PNG frames into the encoder: JPEG intermediates add blocking to the dark
// gradients before H.264 even sees them.
Config.setVideoImageFormat("png");
Config.setOverwriteOutput(true);
Config.setCodec("h264");
Config.setPixelFormat("yuv420p");
Config.setCrf(16);

// WebGL2 through ANGLE. Without a GPU, ANGLE falls back to SwiftShader,
// which is slow but deterministic.
Config.setChromiumOpenGlRenderer("angle");

// WebGL contexts are heavy; four tabs is a good balance on most machines.
Config.setConcurrency(4);

// Software WebGL (SwiftShader) compiles the physical-material shaders and the
// PMREM environment slowly; give the first frame of each tab time to finish.
Config.setDelayRenderTimeoutInMilliseconds(300000);

// Some sandboxed environments block Remotion's own Chrome Headless Shell
// download but ship a Playwright Chromium here. On a normal machine this
// path doesn't exist and Remotion uses its managed browser.
const playwrightHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
}
