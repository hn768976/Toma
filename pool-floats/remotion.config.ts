/**
 * Note: When using the Node.JS APIs, the config file
 * doesn't apply. Instead, pass options directly to the APIs.
 *
 * All configuration options: https://remotion.dev/docs/config
 */

import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

Config.setRspack(true);
// PNG frames + BT.709 => standard limited-range yuv420p H.264 (not full-range yuvj420p)
Config.setVideoImageFormat("png");
Config.setColorSpace("bt709");
Config.setOverwriteOutput(true);
Config.setDefaultPremountInSeconds(2);
// WebGL2 via ANGLE + SwiftShader works headless on any machine (no GPU needed).
Config.setChromiumOpenGlRenderer("swangle");
Config.setCodec("h264");
Config.setPixelFormat("yuv420p");

// Sandboxed environments that cannot download Remotion's Chrome Headless Shell
// can point to an existing Chromium/headless-shell binary instead:
//   REMOTION_BROWSER_EXECUTABLE=/path/to/chrome npx remotion render ...
// On a normal machine nothing is set and Remotion downloads its own browser.
const candidates = [
  process.env.REMOTION_BROWSER_EXECUTABLE,
  "/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell",
].filter((c): c is string => Boolean(c));
const browser = candidates.find((c) => existsSync(c));
if (browser) {
  Config.setBrowserExecutable(browser);
}
