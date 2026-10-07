import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

// WebGL2 through ANGLE. Headless Chromium needs this (equivalent to --gl=angle).
Config.setChromiumOpenGlRenderer("angle");

// Lossless intermediate frames: JPEG frames would add blocking/banding in the dark skies.
Config.setVideoImageFormat("png");
Config.setCodec("h264");
Config.setPixelFormat("yuv420p");
Config.setCrf(16);
Config.setOverwriteOutput(true);
// Software GL can take several seconds per 4K frame.
Config.setDelayRenderTimeoutInMilliseconds(300000);

// Some sandboxed environments block Remotion's Chrome Headless Shell download but ship a
// Playwright Chromium here. On a normal machine this path does not exist and Remotion
// uses its own managed browser.
const playwrightHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
}
