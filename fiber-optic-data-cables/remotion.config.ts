/**
 * Remotion CLI configuration.
 * All configuration options: https://remotion.dev/docs/config
 */
import {Config} from '@remotion/cli/config';

Config.setVideoImageFormat('jpeg');
Config.setJpegQuality(95);
Config.setOverwriteOutput(true);
Config.setCodec('h264');
Config.setPixelFormat('yuv420p');
Config.setCrf(16);
// Headless/CI friendly WebGL (SwiftShader via ANGLE). Use "angle" on a machine with a GPU.
Config.setChromiumOpenGlRenderer('swangle');
// SwiftShader is already multi-threaded; two tabs keep the CPU busy without thrashing.
Config.setConcurrency(2);
Config.setDelayRenderTimeoutInMilliseconds(120000);
// Optional: use a locally installed Chrome Headless Shell (offline / air-gapped machines).
if (process.env.REMOTION_BROWSER_EXECUTABLE) {
	Config.setBrowserExecutable(process.env.REMOTION_BROWSER_EXECUTABLE);
}
