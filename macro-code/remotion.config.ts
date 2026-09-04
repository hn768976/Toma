import {Config} from '@remotion/cli/config';

Config.setCodec('h264');
Config.setPixelFormat('yuv420p');
Config.setColorSpace('bt709');
Config.setCrf(16);
Config.setOverwriteOutput(true);

// PNG frames rather than JPEG. The whole picture is soft gradients and heavy
// blur, which is exactly where JPEG's chroma blocking shows, and it also keeps
// the output limited-range yuv420p instead of picking up JPEG's full range.
Config.setVideoImageFormat('png');
Config.setStillImageFormat('png');

// There is no sound here; without this Remotion muxes a silent AAC track, which
// runs slightly longer than the video and spoils the loop.
Config.setEnforceAudioTrack(false);
Config.setMuted(true);

// The seven blurred slices are compositing-heavy and ANGLE is meaningfully
// faster than the software path.
Config.setChromiumOpenGlRenderer('angle');
