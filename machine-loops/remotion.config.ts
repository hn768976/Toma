// Config for the Remotion CLI (studio and `npx remotion render`).
import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

// PNG frames, never JPEG: the keying colours (#00FF00, pure white, pure
// black) must reach the encoder untouched.
Config.setVideoImageFormat("png");
Config.setOverwriteOutput(true);
Config.setChromiumOpenGlRenderer("angle");
Config.setCodec("h264");
Config.setPixelFormat("yuv420p");
Config.setCrf(16);

// Sandboxed machines that ship a Playwright Chromium: reuse it instead of
// downloading Remotion's headless shell. Elsewhere this path doesn't exist.
const pw = "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(pw)) {
  Config.setBrowserExecutable(pw);
}
