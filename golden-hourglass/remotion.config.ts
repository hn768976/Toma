/**
 * Note: When using the Node.JS APIs, the config file
 * doesn't apply. Instead, pass options directly to the APIs.
 *
 * All configuration options: https://remotion.dev/docs/config
 */

import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

Config.setRspack(true);
Config.setVideoImageFormat("png");
Config.setOverwriteOutput(true);
// WebGL 2 through ANGLE (same as passing --gl=angle)
Config.setChromiumOpenGlRenderer("angle");

// Some sandboxed machines cannot download Remotion's Chrome Headless Shell but ship one here.
// On a normal machine this path does not exist and Remotion uses its own managed browser.
const localHeadlessShell = "/opt/pw-browsers/chromium_headless_shell";
if (existsSync(localHeadlessShell)) {
  Config.setBrowserExecutable(localHeadlessShell);
}
