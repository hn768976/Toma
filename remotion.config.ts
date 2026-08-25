import {Config} from '@remotion/cli/config';

Config.setEntryPoint('./src/index.ts');
Config.setOverwriteOutput(true);
Config.setVideoImageFormat('jpeg');
Config.setJpegQuality(100);
// Fine text over fast motion is a worst case for h264; keep the bitrate high.
Config.setCrf(12);
Config.setChromiumOpenGlRenderer('swangle');
