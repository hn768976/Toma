import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

// WebGL2 in headless Chromium: ANGLE is the reliable backend (works with and
// without a GPU). Equivalent CLI flag: --gl=angle
Config.setChromiumOpenGlRenderer("angle");

// Lossless intermediate frames: JPEG intermediates would add blocking/banding
// to the soft glows before the H.264 encode.
Config.setVideoImageFormat("png");
Config.setOverwriteOutput(true);
Config.setCodec("h264");
Config.setPixelFormat("yuv420p");
Config.setCrf(16);

// Sandboxed environments that ship a Playwright headless shell instead of
// letting Remotion download its own: reuse it if present. On a normal machine
// this path does not exist and Remotion uses its managed browser.
const playwrightHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
}
