import {Config} from '@remotion/cli/config';

Config.setVideoImageFormat('jpeg');
Config.setOverwriteOutput(true);

// Software GL. Headless Chromium here has no GPU, and SwiftShader-via-ANGLE is
// the backend that renders this scene correctly and byte-identically every run.
Config.setChromiumOpenGlRenderer('swangle');

// This clip has no sound. Without this, Remotion muxes in a silent AAC track.
Config.setEnforceAudioTrack(false);

// Rec.709 limited range, so the file reports yuv420p rather than the
// full-range yuvj420p that players and NLEs interpret inconsistently.
Config.setPixelFormat('yuv420p');
Config.setColorSpace('bt709');

// Only used when you point the render at a Chrome you already have; leave the
// variable unset and Remotion downloads and manages its own.
if (process.env.CHROME_EXECUTABLE) {
  Config.setBrowserExecutable(process.env.CHROME_EXECUTABLE);
}
