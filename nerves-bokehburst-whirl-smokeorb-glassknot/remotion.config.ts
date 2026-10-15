import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

// WebGL2 through ANGLE is the reliable path in headless Chromium.
Config.setChromiumOpenGlRenderer("angle");
// PNG frames: JPEG would add 8x8 block artefacts and banding to the dark gradients.
Config.setVideoImageFormat("png");
Config.setPixelFormat("yuv420p");
Config.setCodec("h264");
Config.setCrf(16);
Config.setOverwriteOutput(true);
// CPU-only (SwiftShader) 4K frames can keep the page busy for longer than the 30 s default.
Config.setDelayRenderTimeoutInMilliseconds(600000);

// Sandboxed environments that cannot download Remotion's Chrome Headless Shell
// may ship Playwright's. Use it when present; elsewhere Remotion's own is used.
const pw = "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(pw)) {
  Config.setBrowserExecutable(pw);
}
