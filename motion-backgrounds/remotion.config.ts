import { Config } from "@remotion/cli/config";

// PNG, not JPEG. These are large smooth gradients: JPEG intermediates block
// up in the ramps and partly destroy the sub-LSB dither the shaders apply to
// prevent banding. PNG also keeps the frames in RGB, so the encoder tags the
// output as limited-range yuv420p rather than full-range yuvj420p.
Config.setVideoImageFormat("png");
Config.setCodec("h264");
Config.setPixelFormat("yuv420p");
// These are large flat gradients; a low CRF is what keeps the ramps from
// banding once H.264 quantisation gets hold of them.
Config.setCrf(16);
Config.setColorSpace("bt709");
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
