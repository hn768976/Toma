import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

// PNG intermediates, not JPEG: these are large smooth dark gradients under
// bright glow, and JPEG intermediates would add their own banding on top of
// whatever the H.264 encode does.
Config.setVideoImageFormat("png");
Config.setStillImageFormat("png");
Config.setCodec("h264");
Config.setPixelFormat("yuv420p");
Config.setCrf(16);
Config.setOverwriteOutput(true);
Config.setChromiumOpenGlRenderer("angle");

// Some sandboxed environments block Remotion's own Chrome Headless Shell
// download but ship a Playwright Chromium. Reuse it there; on a normal
// machine this path does not exist and Remotion uses its managed browser.
const playwrightHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
}
