import {Config} from '@remotion/cli/config';

Config.setVideoImageFormat('png');
Config.setOverwriteOutput(true);
Config.setChromiumOpenGlRenderer('angle');
// No audio: Remotion would otherwise mux a silent track into every render.
Config.setMuted(true);

export {};
