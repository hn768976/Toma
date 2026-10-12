import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

// WebGL2 through ANGLE. On a machine with a GPU this uses it; in a GPU-less
// container ANGLE falls back to SwiftShader (software) — same pixels, slower.
Config.setChromiumOpenGlRenderer("angle");
// PNG intermediates: JPEG would add its own 8x8 blocking and banding on the glows.
Config.setVideoImageFormat("png");
Config.setOverwriteOutput(true);
Config.setPixelFormat("yuv420p");
Config.setCodec("h264");
Config.setCrf(16);
Config.setMuted(true);
// Rendering is GPU bound; a long timeout keeps a slow software-GL 4K frame from failing.
Config.setDelayRenderTimeoutInMilliseconds(240000);

// Sandboxed environments that ship a Playwright Chromium instead of letting
// Remotion download its own headless shell: reuse it. On a normal machine this
// path does not exist and Remotion uses its managed browser.
const playwrightHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
}
