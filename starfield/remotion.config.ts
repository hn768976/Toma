import {Config} from '@remotion/cli/config';

Config.setVideoImageFormat('png');
Config.setPixelFormat('yuv420p');
Config.setCodec('h264');
// Visually lossless for a background plate; raise the number to shrink the file.
Config.setCrf(16);
Config.setChromiumOpenGlRenderer('swangle');
Config.setOverwriteOutput(true);
