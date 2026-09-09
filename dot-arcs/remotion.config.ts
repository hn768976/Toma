import { Config } from '@remotion/cli/config';

Config.setVideoImageFormat('png');
Config.setCodec('h264');
Config.setPixelFormat('yuv420p');
Config.setCrf(15);
Config.setOverwriteOutput(true);
Config.setChromiumOpenGlRenderer('angle');

// Remotion downloads its own headless shell on first render. Set REMOTION_BROWSER
// to use a Chrome that is already on the machine instead.
if (process.env.REMOTION_BROWSER) {
  Config.setBrowserExecutable(process.env.REMOTION_BROWSER);
}
