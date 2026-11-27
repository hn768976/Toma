/**
 * Note: When using the Node.JS APIs, the config file
 * doesn't apply. Instead, pass options directly to the APIs.
 *
 * All configuration options: https://remotion.dev/docs/config
 */

import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

Config.setRspack(true);
// PNG intermediates: lossless frames into the H.264 encoder (no JPEG banding
// in soft gradients) and byte-exact stills for the determinism check.
Config.setVideoImageFormat("png");
Config.setOverwriteOutput(true);
Config.setChromiumOpenGlRenderer("angle");

// Sandboxed build machines that cannot download Remotion's Chrome Headless
// Shell may ship a headless shell at this path. Everywhere else the file does
// not exist and Remotion uses its own managed browser.
const localHeadlessShell = "/opt/pw-browsers/chromium_headless_shell";
if (existsSync(localHeadlessShell)) {
  Config.setBrowserExecutable(localHeadlessShell);
}
