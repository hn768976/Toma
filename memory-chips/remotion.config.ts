/**
 * Note: When using the Node.JS APIs, the config file
 * doesn't apply. Instead, pass options directly to the APIs.
 *
 * All configuration options: https://remotion.dev/docs/config
 */

import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

Config.setRspack(true);
// PNG intermediates: lossless frames into the encoder, and byte-stable stills.
Config.setVideoImageFormat("png");
Config.setStillImageFormat("png");
Config.setOverwriteOutput(true);
Config.setChromiumOpenGlRenderer("angle");

// Some sandboxed build machines cannot download Remotion's own Chrome Headless
// Shell but ship one at this path. Reuse it there; on a normal machine the path
// does not exist and Remotion downloads and uses its own managed browser.
const sandboxHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell";
if (existsSync(sandboxHeadlessShell)) {
  Config.setBrowserExecutable(sandboxHeadlessShell);
}
