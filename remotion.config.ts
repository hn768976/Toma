import { Config } from '@remotion/cli/config';

Config.setVideoImageFormat('jpeg');
Config.setOverwriteOutput(true);
Config.setChromiumOpenGlRenderer('swangle');
// The scene allocates several full-frame offscreen buffers per render worker.
Config.setChromiumDisableWebSecurity(false);

// This machine has no egress to remotion.media, so use the Chromium that is
// already on disk instead of letting Remotion download Chrome Headless Shell.
// Override with REMOTION_BROWSER_EXECUTABLE, or delete these lines on a
// machine where Remotion can fetch its own binary.
const localChromium = process.env.REMOTION_BROWSER_EXECUTABLE;
if (localChromium) {
  Config.setBrowserExecutable(localChromium);
}
