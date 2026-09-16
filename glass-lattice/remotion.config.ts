import {Config} from '@remotion/cli/config';

Config.setVideoImageFormat('jpeg');
Config.setJpegQuality(100);
Config.setCodec('h264');
Config.setPixelFormat('yuv420p');
Config.setColorSpace('bt709');
Config.setOverwriteOutput(true);

// The piece has no sound. Without this Remotion muxes a silent AAC track.
Config.setEnforceAudioTrack(false);
Config.setMuted(true);

// Building the three.js scene and PMREM environment on the first frame takes a
// while on a software rasteriser.
Config.setDelayRenderTimeoutInMilliseconds(180_000);

// SwiftShader/ANGLE — the only thing that works on a GPU-less render machine.
// On a box with a real GPU, `--gl=angle` (or WebGPU) will be much faster.
Config.setChromiumOpenGlRenderer('swangle');
