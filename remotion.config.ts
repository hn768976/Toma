import {Config} from '@remotion/cli/config';

Config.setVideoImageFormat('jpeg');
Config.setOverwriteOutput(true);
Config.setMuted(true); // these compositions carry no audio
Config.setChromiumOpenGlRenderer('swangle');

export {};
