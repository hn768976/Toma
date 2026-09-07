import { Config } from "@remotion/cli/config";

// PNG intermediates, not JPEG. Two reasons: JPEG frames are full-range, which
// makes x264 emit yuvj420p instead of the yuv420p this needs to deliver as, and
// chroma-subsampled intermediates would soften thousands of 1px dots before the
// encoder ever sees them.
Config.setVideoImageFormat("png");
Config.setOverwriteOutput(true);

// WebGL in headless Chromium. "angle" is the fast path when a GPU is present;
// "swiftshader" is the CPU fallback and works anywhere, just slower.
Config.setChromiumOpenGlRenderer("angle");

// High-contrast dark detail on a flat white field is the H.264 failure mode
// here - mosquito noise around the globe, not banding. Keep the rate high.
Config.setCrf(16);
Config.setPixelFormat("yuv420p");
Config.setCodec("h264");

// No audio in this clip, and a silent AAC track is just something for a stock
// review to query.
Config.setMuted(true);
