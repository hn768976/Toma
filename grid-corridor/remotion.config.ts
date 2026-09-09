import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("png");
Config.setPixelFormat("yuv420p");
Config.setCodec("h264");
// Thin bright lines on black band badly in H.264 — keep the quality high.
Config.setCrf(15);
// No audio in any composition.
Config.setMuted(true);
Config.setChromiumOpenGlRenderer("angle");
Config.setOverwriteOutput(true);
