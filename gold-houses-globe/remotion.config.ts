import { Config } from "@remotion/cli/config";

// Lossless intermediate frames: JPEG frames would add blocking/banding to
// the dark gradients before the encoder even sees them.
Config.setVideoImageFormat("png");
Config.setOverwriteOutput(true);
Config.setCodec("h264");
Config.setPixelFormat("yuv420p");
Config.setCrf(16);
// WebGL2 through ANGLE. Works with and without a GPU in headless Chromium.
Config.setChromiumOpenGlRenderer("angle");
// Generous: the first frame of a tab compiles shaders and builds PMREM maps.
Config.setDelayRenderTimeoutInMilliseconds(120000);
