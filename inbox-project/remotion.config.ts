/**
 * Note: when rendering through the Node.JS APIs this file does not apply --
 * pass the options directly to the APIs instead.
 * All options: https://remotion.dev/docs/config
 */
import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

Config.setRspack(true);
Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
Config.setPixelFormat("yuv420p");
Config.setCodec("h264");
// The JPEG intermediate frames are full-range, which makes x264 tag the output
// yuvj420p / color_range=pc. Pinning the colour space forces the limited-range
// bt709 tagging that yuv420p deliverables are expected to carry.
Config.setColorSpace("bt709");

// Some sandboxed CI/dev containers block the download of Remotion's own
// Chrome Headless Shell but already ship a Playwright Chromium. Reuse it
// there. On a normal machine this path does not exist and Remotion falls
// back to its default managed browser, so the project stays portable.
const playwrightHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
}
