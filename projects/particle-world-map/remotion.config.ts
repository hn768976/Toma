/**
 * Note: When using the Node.JS APIs, the config file
 * doesn't apply. Instead, pass options directly to the APIs.
 *
 * All configuration options: https://remotion.dev/docs/config
 */
import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

Config.setRspack(true);
// WebGL 2 in headless Chrome. "swangle" (SwiftShader via ANGLE) works on any
// machine, with or without a GPU. On a machine with a GPU you may pass
// --gl=angle on the command line for faster renders.
Config.setChromiumOpenGlRenderer("swangle");
Config.setVideoImageFormat("png");
Config.setCodec("h264");
Config.setPixelFormat("yuv420p");
Config.setCrf(16);
Config.setOverwriteOutput(true);
// WebGL frames are heavy at 4K; keep each tab's GPU work isolated.
Config.setConcurrency(2);
Config.setDelayRenderTimeoutInMilliseconds(120000);

// Sandboxed environments that block Remotion's browser download can point at
// an existing Chrome Headless Shell via REMOTION_BROWSER_EXECUTABLE.
// On a normal machine nothing is set and Remotion downloads its own browser.
const customBrowser =
  process.env.REMOTION_BROWSER_EXECUTABLE ??
  "/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell";
if (existsSync(customBrowser)) {
  Config.setBrowserExecutable(customBrowser);
}
