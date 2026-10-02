import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

// PNG frames into the encoder: JPEG intermediates add blocking to the dark
// gradients, which then shows up as banding after H.264.
Config.setVideoImageFormat("png");
Config.setPixelFormat("yuv420p");
Config.setCodec("h264");
Config.setCrf(16);
// No audio stream at all (otherwise the CLI adds a silent AAC track, which
// also pads the duration past 10.0s).
Config.setMuted(true);
Config.setOverwriteOutput(true);

// Some sandboxed environments can't download Remotion's Chrome Headless Shell
// but ship a Playwright one here. On a normal machine this path doesn't exist
// and Remotion uses its own managed browser.
const playwrightHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
}
