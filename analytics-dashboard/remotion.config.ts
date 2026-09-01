/**
 * Remotion config. Note: when using the Node.JS APIs this file does not
 * apply — pass options directly to the APIs instead.
 * All options: https://remotion.dev/docs/config
 */

import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
// The 3D variant needs a real GL implementation; "angle" is the most reliable
// headless backend for @remotion/three renders.
Config.setChromiumOpenGlRenderer("angle");

// Some sandboxed dev environments block downloading Remotion's own Chrome
// Headless Shell but ship a Playwright Chromium. Reuse it when present; on a
// normal machine this path won't exist and Remotion uses its managed browser.
const candidates = [
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell",
  "/opt/pw-browsers/chromium",
];
for (const candidate of candidates) {
  if (existsSync(candidate)) {
    Config.setBrowserExecutable(candidate);
    break;
  }
}
