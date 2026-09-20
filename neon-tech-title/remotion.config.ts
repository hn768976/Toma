import { Config } from '@remotion/cli/config';

Config.setVideoImageFormat('jpeg');
Config.setJpegQuality(96);
Config.setCodec('h264');
Config.setPixelFormat('yuv420p');
Config.setCrf(16);
Config.setOverwriteOutput(true);
Config.setDelayRenderTimeoutInMilliseconds(300000);

/**
 * SwiftShader through ANGLE. This box has no GPU, so this is the renderer
 * that actually backs WebGL2 here. On a GPU host, drop this line (or use
 * 'angle') and the same project renders hardware-accelerated.
 */
Config.setChromiumOpenGlRenderer('swangle');

/**
 * Use a browser that is already on the machine. Remotion would otherwise
 * fetch its own Chrome Headless Shell, and this environment's egress policy
 * does not allow remotion.media.
 */
const localBrowser = process.env.REMOTION_BROWSER_EXECUTABLE;
if (localBrowser) {
  Config.setBrowserExecutable(localBrowser);
}
