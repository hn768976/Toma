import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("png");
Config.setStillImageFormat("png");
Config.overrideWebpackConfig((c) => c);
Config.setChromiumOpenGlRenderer("angle");
Config.setDelayRenderTimeoutInMilliseconds(300000);

// Lets a machine with Chrome already installed skip Remotion's own download:
//   REMOTION_BROWSER_EXECUTABLE=/path/to/chrome npm run batch
const browser = process.env.REMOTION_BROWSER_EXECUTABLE;
if (browser) {
  Config.setBrowserExecutable(browser);
}
