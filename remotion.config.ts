import {Config} from '@remotion/cli/config';

Config.setVideoImageFormat('jpeg');
Config.setOverwriteOutput(true);
// The piece has no audio; without this Remotion muxes a silent AAC track.
Config.setMuted(true);
Config.setEnforceAudioTrack(false);
// The scene allocates several full-resolution offscreen canvases per worker
// (background, three depth-of-field buckets, chip layer). Cap concurrency so a
// 4K render does not exhaust memory.
Config.setConcurrency(3);
Config.setChromiumOpenGlRenderer('angle');
