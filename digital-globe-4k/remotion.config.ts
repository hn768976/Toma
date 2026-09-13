import {Config} from '@remotion/cli/config';

Config.setVideoImageFormat('png');
Config.setCodec('h264');
Config.setPixelFormat('yuv420p');
// Visually lossless for a gradient-heavy scene; banding shows up fast otherwise.
Config.setCrf(16);
Config.setChromiumOpenGlRenderer('angle');
Config.setOverwriteOutput(true);
// The reference clip is silent; don't let Remotion pad in a blank audio track.
Config.setEnforceAudioTrack(false);
