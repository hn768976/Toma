import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

// WebGL2 through ANGLE — reliable in headless Chromium (GPU if present, SwiftShader otherwise).
Config.setChromiumOpenGlRenderer("angle");
// PNG intermediates so grain/dither survive into the encoder untouched.
Config.setVideoImageFormat("png");
Config.setCodec("h264");
Config.setPixelFormat("yuv420p");
Config.setCrf(16);
Config.setOverwriteOutput(true);
Config.setConcurrency(4);
// Software GL (SwiftShader) can take a while to create several contexts in parallel.
Config.setDelayRenderTimeoutInMilliseconds(240000);
// Some sandboxes cannot download Remotion's headless shell but ship Playwright's.
const pw = "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(pw)) {
  Config.setBrowserExecutable(pw);
}
