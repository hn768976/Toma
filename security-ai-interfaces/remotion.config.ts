/**
 * Remotion CLI config. Applies to `npx remotion render|still|studio`.
 * All configuration options: https://remotion.dev/docs/config
 */
import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

// Lossless frame capture: these are flat-colour interfaces with soft
// gradients (look 4, light mode 1B). PNG avoids JPEG blocking and banding
// before the H.264 encode.
Config.setVideoImageFormat("png");
Config.setOverwriteOutput(true);
Config.setCodec("h264");
Config.setPixelFormat("yuv420p");
Config.setCrf(16);
// No audio stream at all (otherwise a silent AAC track is added, which
// also pads the container duration past 20.0 s).
Config.setMuted(true);

// Some sandboxed environments block downloading Remotion's own Chrome
// Headless Shell but ship a Playwright Chromium at this path. On a normal
// machine this path does not exist and Remotion uses its managed browser.
const playwrightHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
}
