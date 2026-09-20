import { Config } from '@remotion/cli/config';

/**
 * Remotion CLI configuration — for `remotion studio` and any CLI render.
 *
 * The production renders go through `scripts/render.mjs`, which sets the same
 * options programmatically (and additionally `chromeMode`, which has no
 * config-file equivalent). Keep the two in step.
 *
 * Remotion always passes `--enable-unsafe-webgpu`, so `navigator.gpu` exists
 * in the headless browser; the GL renderer choice decides whether an actual
 * *adapter* can be acquired.
 *
 *   swangle    --use-gl=angle --use-angle=swiftshader. Works on machines with
 *              no GPU, using Chrome's bundled SwiftShader.
 *   angle-egl  looks like the natural choice for WebGPU but needs a system
 *              libEGL.so.1; without one ANGLE fails to initialise, the GPU
 *              process exits, and three.js silently drops to WebGL.
 *   vulkan     fastest where a real Vulkan driver exists, but Remotion pairs
 *              it with --use-vulkan=native and
 *              --disable-vulkan-fallback-to-gl-for-testing, so on a GPU-less
 *              machine requestAdapter() returns null.
 *
 * Override with REMOTION_GL=vulkan on hardware that has a real GPU.
 */
Config.setChromiumOpenGlRenderer(
  (process.env.REMOTION_GL as 'angle-egl' | 'vulkan' | 'swangle') ?? 'swangle',
);

// Point this at scripts/chrome-webgpu.sh (see the README): Remotion always
// passes --no-zygote, which removes Chrome's GPU process and therefore
// WebGPU, and offers no option to suppress it. The shim strips that flag,
// adds --enable-unsafe-swiftshader, and execs the real browser.
//
// It must resolve to a full Chrome, not chrome-headless-shell: Remotion runs
// the shell with --headless=old, which has no GPU process either.
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
