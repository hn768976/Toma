import {Config} from '@remotion/cli/config';

Config.setVideoImageFormat('jpeg');
Config.setJpegQuality(100);
Config.setOverwriteOutput(true);
Config.setCodec('h264');
Config.setPixelFormat('yuv420p');
Config.setCrf(16);

// WebGL in headless Chromium. 'angle' is the documented default for
// @remotion/three; on a machine without a GPU pass --gl=swiftshader instead
// (correct output, roughly 3x slower). See README.md.
Config.setChromiumOpenGlRenderer('angle');

// The reflection pre-pass plus the bloom/DOF chain makes the first frame slow
// to come up, especially under swiftshader.
Config.setDelayRenderTimeoutInMilliseconds(300000);
