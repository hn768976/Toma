import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

// Lossless intermediate frames so the grain / dither survives to the encoder.
Config.setVideoImageFormat("png");
Config.setCodec("h264");
Config.setPixelFormat("yuv420p");
Config.setCrf(16);
Config.setOverwriteOutput(true);
// WebGL2 through ANGLE works in headless Chromium (needed by HoloPeople_*).
Config.setChromiumOpenGlRenderer("angle");

// Sandboxed environments that ship a Playwright headless shell: reuse it.
// On a normal machine this path doesn't exist and Remotion uses its own browser.
const pw = "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(pw)) {
  Config.setBrowserExecutable(pw);
}
