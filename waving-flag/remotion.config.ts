import {Config} from '@remotion/cli/config';

Config.setVideoImageFormat('jpeg');
Config.setOverwriteOutput(true);

// Software GL. Headless Chromium here has no GPU, and SwiftShader-via-ANGLE is
// the backend that renders this scene correctly and byte-identically every run.
Config.setChromiumOpenGlRenderer('swangle');

// This clip has no sound. setEnforceAudioTrack(false) alone is not enough —
// Remotion still muxes in a silent AAC track. setMuted(true) omits the audio
// stream entirely, which is what `ffprobe` should show.
Config.setEnforceAudioTrack(false);
Config.setMuted(true);

// Rec.709 limited range, so the file reports yuv420p rather than the
// full-range yuvj420p that players and NLEs interpret inconsistently.
Config.setPixelFormat('yuv420p');
Config.setColorSpace('bt709');

// Only used when you point the render at a Chrome you already have; leave the
// variable unset and Remotion downloads and manages its own.
if (process.env.CHROME_EXECUTABLE) {
  Config.setBrowserExecutable(process.env.CHROME_EXECUTABLE);
}
