import {Config} from '@remotion/cli/config';

Config.setVideoImageFormat('png');
Config.setPixelFormat('yuv420p');
Config.setCodec('h264');
Config.setCrf(15);
// The plates are silent by design. Without this Remotion muxes a silent AAC
// track into the mp4; the brief asks for no audio track at all.
Config.setMuted(true);

Config.setOverwriteOutput(true);
Config.setChromiumDisableWebSecurity(false);
