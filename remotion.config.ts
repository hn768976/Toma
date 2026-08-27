import {Config} from '@remotion/cli/config';

Config.setVideoImageFormat('jpeg');
Config.setOverwriteOutput(true);
// 'swangle' = ANGLE over SwiftShader, i.e. software WebGL. Correct for a
// headless/CI machine with no GPU. On a machine with a real GPU, 'angle'
// renders this scene an order of magnitude faster.
Config.setChromiumOpenGlRenderer('swangle');

// This scene compiles a fair number of shaders and warms up a post-processing
// composer before the first frame can be captured. On software WebGL that
// comfortably exceeds delayRender()'s 30s default.
Config.setDelayRenderTimeoutInMilliseconds(300000);
