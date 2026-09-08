import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
Config.setPixelFormat("yuv420p");
Config.setCodec("h264");
// Frames are rasterised as JPEG, which is full range; without an explicit
// colour space ffmpeg carries that through and tags the file yuvj420p. This
// gives a properly tagged yuv420p / limited-range / bt709 stream instead.
Config.setColorSpace("bt709");
// Silent motion-graphics plate: an empty AAC track only trips up QC.
Config.setMuted(true);
Config.setCrf(16);
// The baked basemaps are large images; a lower concurrency keeps peak memory
// sane at 4K. Raise it if the render machine has headroom.
Config.setConcurrency(4);
Config.setChromiumOpenGlRenderer("swangle");
