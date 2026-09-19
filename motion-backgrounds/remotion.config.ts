import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setCodec("h264");
Config.setPixelFormat("yuv420p");
// These are large flat gradients; a low CRF is what keeps the ramps from
// banding once H.264 quantisation gets hold of them.
Config.setCrf(15);
// SwiftShader via ANGLE. Software rasterisation, but it is the only WebGL
// backend that is reliably available on a headless Linux render host.
Config.setChromiumOpenGlRenderer("swangle");
Config.setOverwriteOutput(true);

// Allows pointing at a pre-installed Chromium on hosts where Remotion cannot
// download its own (air-gapped or egress-restricted CI). Unset on a normal
// machine, where Remotion manages the browser itself.
if (process.env.REMOTION_BROWSER_EXECUTABLE) {
  Config.setBrowserExecutable(process.env.REMOTION_BROWSER_EXECUTABLE);
}
