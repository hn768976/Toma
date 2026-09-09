import {Config} from '@remotion/cli/config';

// PNG, not JPEG. JPEG frames are tagged full-range, which makes x264 report
// yuvj420p however the pixel format is set, and its chroma subsampling of the
// neon edges is visible in V1.
Config.setVideoImageFormat('png');
Config.setPixelFormat('yuv420p');

// No audio in any output. There is no audio in these compositions, but
// enforceAudioTrack alone does not stop Remotion muxing in a silent AAC track —
// setMuted is what actually drops it.
Config.setEnforceAudioTrack(false);
Config.setMuted(true);
Config.setCodec('h264');
Config.setCrf(16);
Config.setOverwriteOutput(true);

// V2 renders a WebGL scene. Headless Chromium needs ANGLE to get a usable GL
// context; without it the three.js canvas comes back black.
Config.setChromiumOpenGlRenderer('angle');
