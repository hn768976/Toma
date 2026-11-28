/**
 * Note: When using the Node.JS APIs, the config file
 * doesn't apply. Instead, pass options directly to the APIs.
 *
 * All configuration options: https://remotion.dev/docs/config
 */

import { Config } from "@remotion/cli/config";

Config.setRspack(true);
// WebGL 2 through ANGLE (no WebGPU anywhere in this project)
Config.setChromiumOpenGlRenderer("angle");
// PNG frames: lossless intermediates, and the H.264 output is tagged yuv420p (JPEG frames would give full-range yuvj420p)
Config.setVideoImageFormat("png");
// The first frame compiles every shader. On a machine without a GPU (software WebGL)
// that can take longer than Remotion's default 30 s, so allow it some room.
Config.setDelayRenderTimeoutInMilliseconds(240000);
