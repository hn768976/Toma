/**
 * All configuration options: https://remotion.dev/docs/config
 */
import { Config } from "@remotion/cli/config";

Config.setRspack(true);
Config.setVideoImageFormat("jpeg");
Config.setJpegQuality(95);
Config.setOverwriteOutput(true);
Config.setCodec("h264");
Config.setPixelFormat("yuv420p");
Config.setCrf(16);
// "swangle" = software WebGL, works on machines/servers without a GPU.
// On a workstation with a GPU you can switch to "angle" for faster renders.
Config.setChromiumOpenGlRenderer("swangle");
// Software WebGL needs a while to compile shaders when several tabs start at once.
Config.setDelayRenderTimeoutInMilliseconds(300000);
Config.setColorSpace("bt709");
