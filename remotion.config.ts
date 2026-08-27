import {Config} from '@remotion/cli/config';

Config.setVideoImageFormat('jpeg');
Config.setOverwriteOutput(true);
Config.setChromiumOpenGlRenderer('angle');

// The piece has no audio; without this Remotion attaches a silent AAC track.
Config.setMuted(true);
Config.setEnforceAudioTrack(false);
