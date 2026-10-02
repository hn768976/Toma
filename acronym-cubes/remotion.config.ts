// Remotion CLI config. See README.md for render commands.
import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

Config.setEntryPoint("./src/index.ts");
// PNG frames into the encoder: JPEG intermediates would add blocking and
// banding to the pale paper before H.264 even sees it.
Config.setVideoImageFormat("png");
Config.setCodec("h264");
Config.setPixelFormat("yuv420p");
Config.setCrf(16);
Config.setOverwriteOutput(true);
// WebGL2 in headless Chromium needs ANGLE. On a machine with a GPU this uses
// it; in a GPU-less container ANGLE falls back to SwiftShader.
Config.setChromiumOpenGlRenderer("angle");
Config.setDelayRenderTimeoutInMilliseconds(180000);

// Some sandboxed environments block Remotion's Chrome Headless Shell
// download but ship a Playwright Chromium. Use it when present.
const playwrightHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
}
