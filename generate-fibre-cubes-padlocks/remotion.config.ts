import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

// Lossless intermediate frames so the encoder sees the exact rendered pixels
// (JPEG intermediates add their own blocking/banding in dark gradients).
Config.setVideoImageFormat("png");
Config.setOverwriteOutput(true);
Config.setCodec("h264");
Config.setPixelFormat("yuv420p");
Config.setCrf(16);

// WebGL2 in headless Chromium: ANGLE (falls back to SwiftShader when the
// machine has no GPU). Same as passing --gl=angle on the command line.
Config.setChromiumOpenGlRenderer("angle");

// Sandboxed environments that ship a Playwright headless shell (and block
// Remotion's own browser download) use it; elsewhere Remotion downloads
// its pinned Chrome Headless Shell as usual.
const playwrightHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
}
