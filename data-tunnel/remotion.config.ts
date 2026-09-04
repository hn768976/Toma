/**
 * Note: when using the Node.JS APIs the config file does not apply -
 * pass the equivalent options directly to the APIs instead.
 *
 * All configuration options: https://remotion.dev/docs/config
 */
import { Config } from "@remotion/cli/config";

Config.setRspack(true);
Config.setOverwriteOutput(true);

// PNG frames, not JPEG. The background is a very dark gradient and JPEG's
// chroma subsampling puts visible blocking into it before the H.264 encode
// ever gets a look at it.
Config.setVideoImageFormat("png");

// The depth-of-field layers are WebGL canvases, so headless Chromium needs a
// GL backend. "angle" is what the timings in the README were measured with;
// "swiftshader" also works with no GPU but is slower, and "egl" is fastest on
// a machine with a real GPU.
Config.setChromiumOpenGlRenderer("angle");
