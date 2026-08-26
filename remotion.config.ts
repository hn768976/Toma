import {Config} from '@remotion/cli/config';

Config.setVideoImageFormat('jpeg');
Config.setOverwriteOutput(true);
// The tunnel is drawn with Canvas2D; the software rasteriser is deterministic
// across machines, which matters more here than raw speed.
Config.setChromiumOpenGlRenderer('swangle');

export const config = Config;
