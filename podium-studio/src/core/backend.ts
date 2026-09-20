import * as THREE from 'three/webgpu';

export type BackendChoice = {
  forceWebGL: boolean;
  reason: string;
};

let cached: Promise<BackendChoice> | null = null;

/**
 * Decide whether the WebGPU backend can actually be used, WITHOUT creating a
 * device.
 *
 * Checking for `navigator.gpu` is not enough: a GPU-less container exposes a
 * software adapter (SwiftShader) that hands out a device happily, then never
 * presents a single frame - `renderAsync()` resolves, the canvas stays fully
 * transparent, and you silently render a blank movie.
 *
 * Crucially the probe must not create a device either. A lost software WebGPU
 * device takes the shared GPU process down with it, after which
 * `getContext('webgl2')` returns null and the WebGL2 fallback ALSO dies. So we
 * only inspect adapter metadata, which is cheap and side-effect free, and treat
 * any software/fallback adapter as "no usable WebGPU".
 *
 * Net effect: real GPU -> WebGPU backend. Container/CI -> WebGL2 backend of the
 * same WebGPURenderer, with the same scene graph and the same output.
 */
const SOFTWARE_MARKERS = ['swiftshader', 'llvmpipe', 'lavapipe', 'softwarerasterizer', 'microsoft basic'];

export const chooseBackend = (): Promise<BackendChoice> => {
  if (cached) return cached;

  cached = (async (): Promise<BackendChoice> => {
    const override = process.env.REMOTION_GPU_BACKEND;
    if (override === 'webgl') return {forceWebGL: true, reason: 'forced to WebGL2 by REMOTION_GPU_BACKEND'};
    if (override === 'webgpu') return {forceWebGL: false, reason: 'forced to WebGPU by REMOTION_GPU_BACKEND'};

    if (typeof navigator === 'undefined' || !('gpu' in navigator) || !navigator.gpu) {
      return {forceWebGL: true, reason: 'navigator.gpu unavailable'};
    }

    try {
      const adapter = await navigator.gpu.requestAdapter({
        powerPreference: 'high-performance',
      });
      if (!adapter) return {forceWebGL: true, reason: 'no WebGPU adapter'};

      const info = (adapter as GPUAdapter & {info?: GPUAdapterInfo}).info;
      const haystack = [info?.vendor, info?.architecture, info?.description]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      const isFallback = (adapter as GPUAdapter & {isFallbackAdapter?: boolean}).isFallbackAdapter === true;
      const isSoftware = isFallback || SOFTWARE_MARKERS.some((m) => haystack.includes(m));

      if (isSoftware) {
        return {
          forceWebGL: true,
          reason: `software WebGPU adapter (${haystack || 'unknown'}) cannot present`,
        };
      }
      return {forceWebGL: false, reason: `WebGPU adapter ${haystack || 'ok'}`};
    } catch (err) {
      return {forceWebGL: true, reason: `adapter query failed: ${(err as Error).message.slice(0, 70)}`};
    }
  })();

  return cached;
};

/** Human-readable backend name for logging after the renderer exists. */
export const backendName = (renderer: THREE.WebGPURenderer) =>
  renderer.backend?.constructor?.name ?? 'unknown';
