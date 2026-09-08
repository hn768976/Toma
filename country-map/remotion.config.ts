import {Config} from '@remotion/cli/config';

Config.setVideoImageFormat('jpeg');
// The relief is a low-contrast ramp, so the frame intermediates are kept at a
// quality where JPEG cannot band it.
Config.setJpegQuality(95);
Config.setCodec('h264');
Config.setPixelFormat('yuv420p');
// Without an explicit colour space the encoder tags the output yuvj420p (full
// range), which some players show washed out.
Config.setColorSpace('bt709');
Config.setCrf(16);
// No audio track. These are silent map beds, and a stock file that carries an
// empty AAC stream gets flagged.
Config.setMuted(true);
Config.setEnforceAudioTrack(false);
Config.setChromiumOpenGlRenderer('angle');
Config.setEntryPoint('src/index.ts');
