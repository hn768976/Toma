/**
 * Note: When using the Node.JS APIs, the config file
 * doesn't apply. Instead, pass options directly to the APIs.
 *
 * All configuration options: https://remotion.dev/docs/config
 */

import { Config } from "@remotion/cli/config";

Config.setRspack(true);
// WebGL 2 is required. "swangle" (SwiftShader via ANGLE) works on every
// machine, including servers without a GPU. On a machine with a GPU you can
// pass `--gl=angle` on the command line for much faster renders.
Config.setChromiumOpenGlRenderer("swangle");
Config.setVideoImageFormat("jpeg");
Config.setJpegQuality(95);
Config.setOverwriteOutput(true);
Config.setCodec("h264");
Config.setPixelFormat("yuv420p");
// Standard HD delivery: BT.709 matrix, TV (limited) range, tagged in the file.
Config.setColorSpace("bt709");
Config.setCrf(16);
// Software WebGL (SwiftShader) can take a while to compile shaders on busy or
// slow CPUs; allow generous time before Remotion gives up on a frame.
Config.setDelayRenderTimeoutInMilliseconds(180000);
Config.setTimeoutInMilliseconds(180000);
