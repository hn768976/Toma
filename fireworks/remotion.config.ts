import {Config} from '@remotion/cli/config';

Config.setVideoImageFormat('jpeg');
Config.setOverwriteOutput(true);
// The piece has no audio, so don't write a silent track into the file.
Config.setMuted(true);
