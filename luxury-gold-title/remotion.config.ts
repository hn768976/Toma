import {Config} from '@remotion/cli/config';

// PNG intermediates: the backdrop is a very dark, very smooth gradient, and a
// JPEG intermediate bands visibly in those tones.
Config.setVideoImageFormat('png');
Config.setCodec('h264');
Config.setPixelFormat('yuv420p');
Config.setCrf(16);
// These are silent background plates - don't attach an empty audio track.
Config.setEnforceAudioTrack(false);
Config.setOverwriteOutput(true);
Config.setChromiumOpenGlRenderer('angle');
