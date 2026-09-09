import {Config} from '@remotion/cli/config';

Config.setVideoImageFormat('jpeg');
Config.setCodec('h264');
Config.setPixelFormat('yuv420p');
Config.setCrf(16);
Config.setOverwriteOutput(true);
// Software GL via ANGLE/SwiftShader — required for headless three.js rendering.
Config.setChromiumOpenGlRenderer('swangle');
Config.setConcurrency(4);
Config.setDelayRenderTimeoutInMilliseconds(120000);

// Use a locally-installed Chromium when one is provided (CI / sandboxes with
// no egress to remotion.media). Falls back to Remotion's own download.
if (process.env.REMOTION_BROWSER) {
  Config.setBrowserExecutable(process.env.REMOTION_BROWSER);
}
