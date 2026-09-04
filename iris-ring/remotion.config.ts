import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("png");
Config.setOverwriteOutput(true);
Config.setCodec("h264");
Config.setPixelFormat("yuv420p");

// Silent piece — without this Remotion attaches an empty AAC track.
Config.setMuted(true);

// This is a 2D canvas, so no GPU is needed. SwiftShader rasterises in
// software and is dramatically faster here than Remotion's `swangle`
// default for headless machines: ~3 s/frame at 4K versus ~48 s.
Config.setChromiumOpenGlRenderer("swiftshader");
