import {Config} from '@remotion/cli/config';

// PNG frames rather than JPEG: the relief is a low-contrast ramp, and JPEG
// intermediates also make the encoder tag the output yuvj420p (full range),
// which some players show washed out.
Config.setVideoImageFormat('png');
Config.setCodec('h264');
Config.setPixelFormat('yuv420p');
Config.setColorSpace('bt709');
Config.setCrf(16);
Config.setChromiumOpenGlRenderer('angle');
Config.setEntryPoint('src/index.ts');
