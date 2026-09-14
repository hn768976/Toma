import {Config} from '@remotion/cli/config';

Config.setVideoImageFormat('jpeg');
Config.setOverwriteOutput(true);
/**
 * Per-frame glitch noise is expensive to compress: at a softer CRF the bands
 * smear into mush. 13 holds them.
 */
Config.setCrf(13);
Config.setPixelFormat('yuv420p');
Config.setCodec('h264');
/**
 * Frames are handed to the encoder as JPEGs, which x264 would otherwise tag as
 * full-range (yuvj420p). Declaring bt709 keeps the output a plain, correctly
 * tagged yuv420p.
 */
Config.setColorSpace('bt709');
/** No audio track anywhere in this project: there is no sound to carry. */
Config.setMuted(true);
Config.setEnforceAudioTrack(false);
