import {Config} from '@remotion/cli/config';

Config.setVideoImageFormat('jpeg');
Config.setCodec('h264');
Config.setPixelFormat('yuv420p');
Config.setOverwriteOutput(true);

// Building the three.js scene and PMREM environment on the first frame takes a
// while on a software rasteriser.
Config.setDelayRenderTimeoutInMilliseconds(180_000);

// SwiftShader/ANGLE — the only thing that works on a GPU-less render machine.
// On a box with a real GPU, `--gl=angle` (or WebGPU) will be much faster.
Config.setChromiumOpenGlRenderer('swangle');
