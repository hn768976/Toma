import {Config} from '@remotion/cli/config';

Config.setVideoImageFormat('png');
Config.setCodec('h264');
Config.setPixelFormat('yuv420p');
Config.setEntryPoint('src/index.ts');

/**
 * ANGLE-over-Vulkan (SwiftShader when there is no discrete GPU).
 * Remotion always passes --enable-unsafe-webgpu, so three.js selects its WebGPU
 * backend; this setting governs the WebGL2 fallback path.
 */
Config.setChromiumOpenGlRenderer('vulkan');

/**
 * Optional escape hatch for sandboxed/offline CI where Remotion cannot download
 * its own Chrome Headless Shell. Unset on a normal machine, where Remotion
 * manages the browser itself.
 */
if (process.env.REMOTION_BROWSER_EXECUTABLE) {
  Config.setBrowserExecutable(process.env.REMOTION_BROWSER_EXECUTABLE);
}
