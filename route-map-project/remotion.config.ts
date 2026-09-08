import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
Config.setPixelFormat("yuv420p");
Config.setCodec("h264");
Config.setCrf(16);
// The baked basemaps are large images; a lower concurrency keeps peak memory
// sane at 4K. Raise it if the render machine has headroom.
Config.setConcurrency(4);
Config.setChromiumOpenGlRenderer("swangle");
