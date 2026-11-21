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
// Standard HD/UHD colour: BT.709 matrix, tagged in the stream, so players and editors show the same colours as the frames.
Config.setColorSpace("bt709");
Config.setChromiumOpenGlRenderer("angle");
// 4K frames on a machine without a GPU can take longer than the default 30 s.
Config.setDelayRenderTimeoutInMilliseconds(600000);

// Some sandboxed build machines cannot download Remotion's own Chrome Headless
// Shell but ship one at this path. Reuse it there; on a normal machine the path
// does not exist and Remotion downloads and uses its own managed browser.
const sandboxHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell";
if (existsSync(sandboxHeadlessShell)) {
  Config.setBrowserExecutable(sandboxHeadlessShell);
}
