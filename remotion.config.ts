import {Config} from '@remotion/cli/config';

Config.setVideoImageFormat('jpeg');
Config.setOverwriteOutput(true);
// The piece has no audio; without this Remotion muxes in a silent AAC track.
Config.setMuted(true);

// The tunnel is drawn entirely with Canvas2D, so the software rasteriser is
// enough and it keeps output identical from one machine to the next. On a
// desktop with a real GPU you can drop this line for a faster 4K pass.
Config.setChromiumOpenGlRenderer('swangle');

export const config = Config;
