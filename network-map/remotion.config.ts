import {Config} from '@remotion/cli/config';

Config.setVideoImageFormat('jpeg');
Config.setOverwriteOutput(true);
Config.setChromiumOpenGlRenderer('angle');

// The piece has no audio, and Remotion would otherwise attach a silent track.
Config.setMuted(true);
Config.setEnforceAudioTrack(false);
