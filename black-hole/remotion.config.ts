import {Config} from '@remotion/cli/config';

Config.setVideoImageFormat('png');
Config.setPixelFormat('yuv420p');
Config.setCodec('h264');
Config.setCrf(16);
Config.setOverwriteOutput(true);
Config.setMuted(true);   // there is no audio in this project; ship video-only

// The scene is a per-pixel ray march, so the renderer choice dominates render
// time. Machines with a GPU should keep 'angle'; headless boxes without one
// need `--gl=swangle` on the command line (see README).
Config.setChromiumOpenGlRenderer('angle');
