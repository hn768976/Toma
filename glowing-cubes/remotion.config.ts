// Remotion CLI config. (Node APIs ignore this file — pass the same options there.)
import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

// WebGL2 through ANGLE. Equivalent CLI flag: --gl=angle
Config.setChromiumOpenGlRenderer("angle");

// Lossless intermediate frames: JPEG frames would add blocking to the dark
// gradients before H.264 even sees them.
Config.setVideoImageFormat("png");
Config.setCodec("h264");
Config.setPixelFormat("yuv420p");
Config.setCrf(16);
Config.setOverwriteOutput(true);
// WebGL frames are heavy; one tab per two cores is a good default.
Config.setConcurrency(2);
Config.setDelayRenderTimeoutInMilliseconds(120000);

// Sandboxed CI images sometimes ship Playwright's Chromium instead of letting
// Remotion download its own headless shell. Use it when it's there.
const playwrightHeadlessShell = "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
}
