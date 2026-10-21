import { Config } from "@remotion/cli/config";

// WebGL2 through ANGLE (the three.js and PixiJS scenes both need it).
Config.setChromiumOpenGlRenderer("angle");
// Lossless frames into the encoder; JPEG would add its own artefacts before H.264.
Config.setVideoImageFormat("png");
Config.setPixelFormat("yuv420p");
// BT.709, tagged, converted with zscale: the light background #FBFBFA decodes back to
// within 1 of itself (the default untagged path rounds blue down by 3).
Config.setColorSpace("bt709");
Config.setCodec("h264");
Config.setCrf(16);
Config.setConcurrency(2);
Config.setDelayRenderTimeoutInMilliseconds(120000);
