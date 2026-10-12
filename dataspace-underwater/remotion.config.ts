/**
 * Remotion CLI config. (Node.js render APIs ignore this file — pass the same
 * options directly there.)
 */
import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

// PNG frames: lossless intermediate so the encoder sees the dithered gradients
// exactly as rendered (JPEG intermediates re-introduce banding in dark blues).
Config.setVideoImageFormat("png");
Config.setOverwriteOutput(true);
Config.setPixelFormat("yuv420p");
Config.setCodec("h264");
Config.setCrf(16);

// WebGL2 through ANGLE. Headless Chromium needs this (equivalent to --gl=angle).
Config.setChromiumOpenGlRenderer("angle");

// Software GL at 4K is slow: give each frame room.
Config.setTimeoutInMilliseconds(240000);

// Sandboxed environments that ship a Playwright Chromium instead of letting
// Remotion download its own headless shell. On a normal machine this path does
// not exist and Remotion uses its managed browser.
const playwrightHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
}
