import { Config } from "@remotion/cli/config";

// Lossless frame capture: JPEG would put noise into the "empty" areas, which must stay
// exactly (0,0,0) / (255,255,255) / #E0920A for the blend modes to work.
Config.setVideoImageFormat("png");
Config.setCodec("h264");
Config.setPixelFormat("yuv420p");
Config.setCrf(12);
Config.setMuted(true);
// The base textures are a WebGL2 fragment shader on a three.js plane.
Config.setChromiumOpenGlRenderer("angle");
Config.setOverwriteOutput(true);
// Optional: point Remotion at a local Chromium instead of its downloaded headless shell.
if (process.env.REMOTION_BROWSER_EXECUTABLE) {
  Config.setBrowserExecutable(process.env.REMOTION_BROWSER_EXECUTABLE);
}

// Tag the output as BT.709 (the HD standard) so players decode the colours as they were encoded.
Config.setColorSpace("bt709");
// (Remotion then converts with zscale's exact BT.709 matrix: flat #E0920A encodes to the optimal Y/U/V 147/60/168.)
