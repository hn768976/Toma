import {Config} from '@remotion/cli/config';

// WebGL2 in headless Chromium. On a machine with a GPU, ANGLE uses it; on a
// GPU-less render box use `--gl=swangle` (SwiftShader through ANGLE) instead.
Config.setChromiumOpenGlRenderer('angle');
Config.setVideoImageFormat('png');
Config.setPixelFormat('yuv420p');
Config.setCodec('h264');
Config.setCrf(16);
Config.setConcurrency(2);
