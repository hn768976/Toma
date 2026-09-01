import { Config } from '@remotion/cli/config';

Config.setVideoImageFormat('jpeg');
Config.setOverwriteOutput(true);
// The demo draws to canvas throughout; one concurrent worker keeps the
// per-frame offscreen buffers from multiplying across processes.
Config.setConcurrency(2);
