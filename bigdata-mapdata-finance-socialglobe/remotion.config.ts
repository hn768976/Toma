import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

// Every frame is a pure function of the frame number, so lossless PNG frames
// are used for stills and image sequences; mp4 encoding still uses CRF 16.
Config.setVideoImageFormat("png");
Config.setOverwriteOutput(true);
Config.setPixelFormat("yuv420p");
Config.setCrf(16);
Config.setCodec("h264");
Config.setMuted(true);

// WebGL2 through ANGLE. On a machine with a GPU, "angle" uses it.
// In a GPU-less container, override with --gl=swangle (ANGLE on SwiftShader).
Config.setChromiumOpenGlRenderer("angle");

// Big canvases (8192^2 textures) and long software-GL frames need headroom.
Config.setDelayRenderTimeoutInMilliseconds(600000);

// Sandboxed environments that ship a Playwright headless shell: reuse it
// instead of downloading Remotion's managed Chrome. Elsewhere this is a no-op.
const playwrightHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
}
