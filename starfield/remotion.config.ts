import {Config} from '@remotion/cli/config';

Config.setVideoImageFormat('png');
Config.setPixelFormat('yuv420p');
Config.setCodec('h264');
// Full-frame 2% grain is close to incompressible, so it — not the starfield —
// sets the bitrate. 18 is a good master default; 16 is near-lossless and can
// double the file, 22 stays clean and roughly halves it.
Config.setCrf(18);
Config.setChromiumOpenGlRenderer('swangle');
Config.setOverwriteOutput(true);
