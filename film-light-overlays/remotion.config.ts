import { Config } from "@remotion/cli/config";

// WebGL2 through ANGLE (works headless, with or without a GPU).
Config.setChromiumOpenGlRenderer("angle");
// Lossless frames into the encoder: no JPEG blocking in the dark gradients.
Config.setVideoImageFormat("png");
Config.setCodec("h264");
Config.setPixelFormat("yuv420p");
Config.setCrf(16);
Config.setMuted(true);
Config.setOverwriteOutput(true);
