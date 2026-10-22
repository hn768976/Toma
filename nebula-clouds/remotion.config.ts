/**
 * Note: When using the Node.JS APIs, the config file
 * doesn't apply. Instead, pass options directly to the APIs.
 *
 * All configuration options: https://remotion.dev/docs/config
 */

import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

Config.setRspack(true);
Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
// TV-range BT.709 output, matching the reference and standard players.
Config.setPixelFormat("yuv420p");
Config.setColorSpace("bt709");
Config.setDefaultPremountInSeconds(2);

// The nebula is a WebGL 2 shader. "angle" uses the GPU when one exists;
// on GPU-less render machines pass `--gl=swangle` on the command line.
Config.setChromiumOpenGlRenderer("angle");

// Some sandboxed environments block downloading Remotion's Chrome Headless
// Shell but ship a Playwright build at this path; reuse it when present.
const playwrightHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
}
