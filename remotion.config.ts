import { Config } from '@remotion/cli/config';

Config.setVideoImageFormat('jpeg');
Config.setOverwriteOutput(true);
// The scene is entirely canvas 2D, so a software GL backend is fine and is the
// most portable choice for headless rendering.
Config.setChromiumOpenGlRenderer('swangle');

// Use a Chromium that is already on disk when one is pointed at, instead of
// letting Remotion download Chrome Headless Shell. Leave the variable unset on
// a machine that can fetch its own binary.
const localChromium = process.env.REMOTION_BROWSER_EXECUTABLE;
if (localChromium) {
  Config.setBrowserExecutable(localChromium);
}
