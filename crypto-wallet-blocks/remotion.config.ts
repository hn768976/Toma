import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

// three.js on WebGL2. Headless Chromium only exposes a dependable WebGL2
// context through ANGLE, so pin it here (equivalent to `--gl=angle`).
Config.setChromiumOpenGlRenderer("angle");

// Lossless frames: JPEG intermediates would add blocking and banding to the
// near-black background before the H.264 encode even starts.
Config.setVideoImageFormat("png");
Config.setCodec("h264");
Config.setPixelFormat("yuv420p");
Config.setCrf(16);
Config.setOverwriteOutput(true);
// Software GL at 4K can take well over the default 30 s per frame.
Config.setDelayRenderTimeoutInMilliseconds(900000);

// Sandboxed environments that ship a Playwright headless shell but block
// Remotion's own browser download. On a normal machine this path does not
// exist and Remotion uses its managed Chrome Headless Shell.
const playwrightHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
}
