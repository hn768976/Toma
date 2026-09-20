import { useEffect, useState } from 'react';
import { continueRender, delayRender } from 'remotion';

export type Backend = 'webgpu' | 'webgl2' | 'webgl';

/**
 * Probe the graphics stack once, in priority order:
 *
 *   WebGPU  ->  WebGL2  ->  WebGL
 *
 * WebGPU is only claimed when an adapter is actually handed out, not merely
 * when `navigator.gpu` exists, because headless Chromium exposes the object
 * on platforms where no adapter can be created.
 */
export const detectBackend = async (): Promise<Backend> => {
  try {
    const gpu = (navigator as Navigator & { gpu?: { requestAdapter: () => Promise<unknown> } }).gpu;
    if (gpu && typeof gpu.requestAdapter === 'function') {
      const adapter = await gpu.requestAdapter();
      if (adapter) {
        return 'webgpu';
      }
    }
  } catch {
    // fall through to WebGL
  }

  try {
    const canvas = document.createElement('canvas');
    if (canvas.getContext('webgl2')) {
      return 'webgl2';
    }
    if (canvas.getContext('webgl')) {
      return 'webgl';
    }
  } catch {
    // fall through
  }

  return 'webgl';
};

/**
 * Resolves the backend before the canvas mounts. The render is held with
 * `delayRender` so Remotion never captures a frame against a half-initialised
 * renderer, which would make the first frames of a render differ from the rest.
 */
export const useBackend = (forced?: Backend | 'auto') => {
  const [backend, setBackend] = useState<Backend | null>(
    forced && forced !== 'auto' ? forced : null,
  );

  useEffect(() => {
    if (forced && forced !== 'auto') {
      setBackend(forced);
      return;
    }
    const handle = delayRender('Detecting graphics backend (WebGPU -> WebGL2 -> WebGL)');
    let cancelled = false;
    detectBackend()
      .then((b) => {
        if (!cancelled) setBackend(b);
      })
      .catch(() => {
        if (!cancelled) setBackend('webgl');
      })
      .finally(() => continueRender(handle));
    return () => {
      cancelled = true;
    };
  }, [forced]);

  return backend;
};
