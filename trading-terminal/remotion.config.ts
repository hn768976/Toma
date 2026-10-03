// All configuration options: https://remotion.dev/docs/config
import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("png");
Config.setOverwriteOutput(true);
Config.setPixelFormat("yuv420p");
Config.setCodec("h264");
Config.setCrf(16);
// Video only: no (silent) audio track in the output.
Config.setMuted(true);
// "angle" was ~5x faster than "swangle" for the canvas + CSS 3D compositing
// here, and frames stay byte-identical across threads (see README).
Config.setChromiumOpenGlRenderer("angle");

// Some sandboxed environments block downloading Remotion's Chrome Headless
// Shell but ship a Playwright build at this path. Use it if present;
// elsewhere Remotion downloads its own browser as usual.
const playwrightHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
}
