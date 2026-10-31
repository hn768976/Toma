/**
 * Note: When using the Node.JS APIs, the config file
 * doesn't apply. Instead, pass options directly to the APIs.
 *
 * All configuration options: https://remotion.dev/docs/config
 */

import { Config } from "@remotion/cli/config";

Config.setRspack(true);
// PNG frames avoid JPEG artefacts in the dark gradients before H.264 encoding.
Config.setVideoImageFormat("png");
Config.setOverwriteOutput(true);
Config.setDefaultPremountInSeconds(2);
// The tunnel is a WebGL 2 shader; "swangle" (ANGLE on SwiftShader) gives WebGL 2 in headless Chrome on any machine, GPU or not.
Config.setChromiumOpenGlRenderer("swangle");
// Optional: use a locally installed Chrome / chrome-headless-shell instead of the one Remotion downloads.
if (process.env.REMOTION_BROWSER_EXECUTABLE) {
  Config.setBrowserExecutable(process.env.REMOTION_BROWSER_EXECUTABLE);
}
