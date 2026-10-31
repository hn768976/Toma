/**
 * Note: When using the Node.JS APIs, the config file
 * doesn't apply. Instead, pass options directly to the APIs.
 *
 * All configuration options: https://remotion.dev/docs/config
 */

import { Config } from "@remotion/cli/config";

Config.setRspack(true);
// PNG frames keep the thin neon lines free of JPEG artefacts before H.264 encoding.
Config.setVideoImageFormat("png");
Config.setOverwriteOutput(true);
// Encode with the BT.709 matrix and tag the stream accordingly (HD/UHD standard).
Config.setColorSpace("bt709");
Config.setDefaultPremountInSeconds(2);
// GPU-style compositing (canvas filters, CSS 3D camera in Version 2) via ANGLE on SwiftShader: works on any machine.
Config.setChromiumOpenGlRenderer("swangle");
// Optional: use a locally installed Chrome / chrome-headless-shell instead of the one Remotion downloads.
if (process.env.REMOTION_BROWSER_EXECUTABLE) {
  Config.setBrowserExecutable(process.env.REMOTION_BROWSER_EXECUTABLE);
}
