import {Config} from '@remotion/cli/config';

Config.setCodec('h264');
Config.setPixelFormat('yuv420p');
Config.setColorSpace('bt709');
Config.setCrf(16);
Config.setOverwriteOutput(true);

// The picture is soft gradients and heavy blur, which is exactly where JPEG at
// its default quality would band. PNG frames avoid that but are roughly four
// times slower to capture -- painful at 1080p and punishing at 4K -- and
// quality 100 is indistinguishable here. Stills stay PNG; they are one frame.
Config.setVideoImageFormat('jpeg');
Config.setJpegQuality(100);
Config.setStillImageFormat('png');

// There is no sound here; without this Remotion muxes a silent AAC track, which
// runs slightly longer than the video and spoils the loop.
Config.setEnforceAudioTrack(false);
Config.setMuted(true);

// The seven blurred slices are compositing-heavy and ANGLE is meaningfully
// faster than the software path.
Config.setChromiumOpenGlRenderer('angle');
