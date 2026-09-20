import { Config } from '@remotion/cli/config';

/**
 * Remotion CLI configuration.
 *
 * The three compositions render a three.js scene through a WebGPURenderer.
 * Remotion always passes `--enable-unsafe-webgpu`, so `navigator.gpu` exists
 * in the headless browser; what the GL renderer choice decides is whether an
 * *adapter* can actually be acquired.
 *
 *   angle-egl  works everywhere we have tested, including machines with no
 *              GPU at all (Chrome falls back to its bundled SwiftShader
 *              Vulkan ICD and still exposes a real WebGPU device).
 *   vulkan     is faster on a box with a real Vulkan driver, but Remotion
 *              pairs it with --use-vulkan=native and
 *              --disable-vulkan-fallback-to-gl-for-testing, so on a GPU-less
 *              machine requestAdapter() returns null and three.js silently
 *              drops to its WebGL backend.
 *
 * Override with REMOTION_GL=vulkan on hardware that has a real GPU.
 */
Config.setChromiumOpenGlRenderer(
  (process.env.REMOTION_GL as 'angle-egl' | 'vulkan' | 'swangle') ?? 'angle-egl',
);

// Some environments ship their own Chromium (and cannot reach Remotion's
// download host). REMOTION_BROWSER_EXECUTABLE lets you point at it.
if (process.env.REMOTION_BROWSER_EXECUTABLE) {
  Config.setBrowserExecutable(process.env.REMOTION_BROWSER_EXECUTABLE);
}

// Essential: on Linux Remotion otherwise launches Chrome with --single-process,
// which removes the GPU process and takes WebGPU with it. requestAdapter()
// then returns null and three.js quietly falls back to its WebGL backend.
Config.setChromiumMultiProcessOnLinux(true);

Config.setVideoImageFormat('jpeg');
Config.setJpegQuality(100);
Config.setCodec('h264');
Config.setPixelFormat('yuv420p');
Config.setProResProfile(undefined);
Config.setCrf(16);
Config.setColorSpace('bt709');

// A WebGPU device per tab is expensive; keep the default modest.
Config.setConcurrency(Number(process.env.REMOTION_CONCURRENCY ?? 2));

// Software rasterisation (SwiftShader) can take a while per frame at 4K.
Config.setDelayRenderTimeoutInMilliseconds(300000);

Config.setOverwriteOutput(true);
