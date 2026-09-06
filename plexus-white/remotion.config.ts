/**
 * Note: when using the Node.js APIs this file does not apply; pass the options
 * directly to the APIs instead. https://remotion.dev/docs/config
 */
import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("png");
Config.setPixelFormat("yuv420p");
Config.setCodec("h264");
// Thin near-black lines on a flat white field are the case H.264 handles worst
// in the opposite direction from banding: too low a bitrate and the white
// around each node picks up mosquito noise. Lossless PNG intermediates plus a
// low CRF keep it clean.
Config.setCrf(16);
Config.setOverwriteOutput(true);

// Some sandboxed environments block downloading Remotion's own Chrome Headless
// Shell but ship a Playwright Chromium at this path. On a normal machine the
// path doesn't exist and Remotion falls back to its managed browser.
const playwrightHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
}
