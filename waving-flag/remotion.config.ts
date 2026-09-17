import {Config} from '@remotion/cli/config';

Config.setVideoImageFormat('jpeg');
Config.setOverwriteOutput(true);

// Software GL. Headless Chromium here has no GPU, and SwiftShader-via-ANGLE is
// the backend that renders this scene correctly and identically every run.
Config.setChromiumOpenGlRenderer('swangle');

// Only used when you point the render at a Chrome you already have; leave the
// variable unset and Remotion downloads and manages its own.
if (process.env.CHROME_EXECUTABLE) {
  Config.setBrowserExecutable(process.env.CHROME_EXECUTABLE);
}
