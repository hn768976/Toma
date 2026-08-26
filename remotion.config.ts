import {Config} from '@remotion/cli/config';

// The scene renders through WebGL (three.js + postprocessing).
// On headless Linux there is no GPU, so use SwiftShader-via-ANGLE ("swangle").
// On a desktop with a real GPU, plain "angle" is much faster.
Config.setChromiumOpenGlRenderer(process.platform === 'linux' ? 'swangle' : 'angle');

Config.setVideoImageFormat('jpeg');
Config.setOverwriteOutput(true);
