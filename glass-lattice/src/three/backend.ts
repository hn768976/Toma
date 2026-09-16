import {getRemotionEnvironment} from 'remotion';

export type BackendPreference = 'auto' | 'webgpu' | 'webgl';

/**
 * Which three.js backend to run on.
 *
 * `auto` prefers WebGPU interactively (Studio, browser preview) and WebGL2 for
 * headless CLI renders. That default exists because a GPU-less headless
 * Chromium advertises `navigator.gpu` and lets `WebGPURenderer.init()` succeed,
 * then crashes the renderer process when the swap chain cannot be backed —
 * so probing for an adapter is not enough to rule WebGPU out.
 *
 * Override with `REMOTION_RENDERER_BACKEND=webgpu` when rendering on a machine
 * that really does have a GPU, or `=webgl` to pin the fallback everywhere.
 */
export const resolveForceWebGL = (): boolean => {
  const preference = (process.env.REMOTION_RENDERER_BACKEND ?? 'auto') as BackendPreference;

  if (preference === 'webgpu') {
    return false;
  }
  if (preference === 'webgl') {
    return true;
  }
  return getRemotionEnvironment().isRendering;
};
