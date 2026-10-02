// All configuration options: https://remotion.dev/docs/config
// Note: these apply to the CLI (studio / render / still) only.
import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

// WebGL2 in headless Chromium. "angle" uses the GPU when one exists; on a
// machine with no GPU, ANGLE falls back to its SwiftShader backend.
Config.setChromiumOpenGlRenderer("angle");
Config.setVideoImageFormat("png");
Config.setPixelFormat("yuv420p");
Config.setCodec("h264");
Config.setCrf(16);
Config.setOverwriteOutput(true);
// Three.js scenes are heavy; give slow GPU-less machines time per frame.
Config.setDelayRenderTimeoutInMilliseconds(120000);

// Some sandboxed environments block Remotion's Chrome Headless Shell download
// but ship a Playwright build at this path. Elsewhere this is skipped.
const pw = "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(pw)) {
  Config.setBrowserExecutable(pw);
}
