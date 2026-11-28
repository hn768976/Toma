/**
 * Note: When using the Node.JS APIs, the config file
 * doesn't apply. Instead, pass options directly to the APIs.
 *
 * All configuration options: https://remotion.dev/docs/config
 */

import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

Config.setRspack(true);
// WebGL 2 through ANGLE (same as passing --gl=angle).
Config.setChromiumOpenGlRenderer("angle");
// PNG frames between Chrome and the encoder: JPEG would band the dark
// gradients before H.264 ever sees them.
Config.setVideoImageFormat("png");
Config.setOverwriteOutput(true);
// A software-rendered 4K frame with motion blur can take a while.
Config.setDelayRenderTimeoutInMilliseconds(600000);

// Some sandboxed build machines cannot download Remotion's own Chrome
// Headless Shell but ship one at this path. On a normal machine the path
// does not exist and Remotion uses its managed browser as usual.
const sandboxShell =
  "/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell";
if (existsSync(sandboxShell)) {
  Config.setBrowserExecutable(sandboxShell);
}
