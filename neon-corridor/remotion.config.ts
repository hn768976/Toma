import {Config} from '@remotion/cli/config';

// PNG intermediates, not JPEG. Two reasons: JPEG frames are full-range, which
// makes x264 tag the result yuvj420p rather than the yuv420p we want; and the
// dark, smooth gradients in this scene are exactly what JPEG chroma
// subsampling mangles before H.264 ever sees them.
Config.setVideoImageFormat('png');
Config.setOverwriteOutput(true);
Config.setCodec('h264');
Config.setPixelFormat('yuv420p');
Config.setCrf(16);

// WebGL in headless Chromium. On a machine with no GPU, ANGLE falls back to
// SwiftShader by itself; --gl=swiftshader asks for that directly. See README.md.
Config.setChromiumOpenGlRenderer('angle');

// The reflection pre-pass plus the bloom/DOF chain makes the first frame slow
// to come up, especially under swiftshader.
Config.setDelayRenderTimeoutInMilliseconds(300000);
