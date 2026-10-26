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
Config.setDefaultPremountInSeconds(2);

// The compositions are WebGL2 fragment shaders. SwiftShader via ANGLE
// renders them identically on machines with or without a GPU.
Config.setChromiumOpenGlRenderer("swangle");

// Sandboxed environments that block downloading Remotion's managed Chrome
// Headless Shell may ship a Playwright build at this path; reuse it there.
// On a normal machine the path does not exist and Remotion's default is used.
const playwrightHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell";
if (existsSync(playwrightHeadlessShell)) {
  Config.setBrowserExecutable(playwrightHeadlessShell);
}
