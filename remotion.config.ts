import {Config} from '@remotion/cli/config';

Config.setVideoImageFormat('jpeg');
Config.setOverwriteOutput(true);
Config.setChromiumOpenGlRenderer('angle');

// Remotion normally downloads its own Chrome Headless Shell. In sandboxes that
// already ship a Chromium build, point at it instead:
//   REMOTION_BROWSER_EXECUTABLE=/path/to/chrome npm run render
const browserExecutable = process.env.REMOTION_BROWSER_EXECUTABLE;
if (browserExecutable) {
  Config.setBrowserExecutable(browserExecutable);
}
