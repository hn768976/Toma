/**
 * GPU backend selection, resolved once per page.
 *
 * Both the three.js layers and the PixiJS layers go through
 * `resolveBackend()`, so every canvas in a composition agrees on which
 * backend is in use.
 *
 * The probe is deliberately global and serialised. Reporting a WebGPU adapter
 * is not the same as being able to draw with it, so the probe brings a real
 * renderer up and draws with it before accepting the tier -- but a failed
 * WebGPU swapchain can invalidate the whole GPU process, taking any WebGL
 * contexts on the page down with it. Letting each layer probe for itself
 * therefore breaks compositions that stack several canvases. One probe,
 * cached for everyone, keeps that to a single recoverable attempt.
 */

export type GpuTier = "webgpu" | "webgl2" | "webgl";

/**
 * Minimal structural view of the bits of the WebGPU API we touch. Declaring it
 * locally keeps the project buildable whether or not the ambient DOM typings
 * in use happen to ship WebGPU definitions yet.
 */
type GpuAdapterLike = { requestDevice: () => Promise<{ destroy: () => void }> };
type GpuLike = { requestAdapter: () => Promise<GpuAdapterLike | null> };

type ForcedBackend = "auto" | "webgpu" | "webgl";

declare global {
  // eslint-disable-next-line no-var
  var __neuralForcedBackend: ForcedBackend | undefined;
}

/**
 * Pins the backend for the whole page. Set from a composition's props before
 * any layer mounts, so a render can be locked to WebGL when a machine's
 * WebGPU stack is known to be unreliable.
 */
export const forceBackend = (backend: ForcedBackend): void => {
  if (globalThis.__neuralForcedBackend !== backend) {
    globalThis.__neuralForcedBackend = backend;
    cached = null;
  }
};

let cached: Promise<GpuTier> | null = null;

const canRequestWebGpuDevice = async (): Promise<boolean> => {
  const gpu = (navigator as Navigator & { gpu?: GpuLike }).gpu;
  if (!gpu) {
    return false;
  }

  try {
    const adapter = await gpu.requestAdapter();
    if (!adapter) {
      return false;
    }

    const device = await adapter.requestDevice();
    device.destroy();
    return true;
  } catch {
    return false;
  }
};

/**
 * Brings a WebGPU renderer up on a detached canvas and draws one additive,
 * vertex-coloured triangle with it -- the same material configuration the
 * fibre strands use -- so a backend that only fails at draw time is rejected
 * here rather than halfway through a render.
 */
const webGpuCanDraw = async (): Promise<boolean> => {
  const canvas = document.createElement("canvas");
  canvas.width = 32;
  canvas.height = 32;

  try {
    const [THREE, { WebGPURenderer }] = await Promise.all([
      import("three"),
      import("three/webgpu"),
    ]);

    const renderer = new WebGPURenderer({ canvas, antialias: true, alpha: true });
    await renderer.init();

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    camera.position.z = 5;

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(
        new Float32Array([-1, -1, 0, 1, -1, 0, 1, 1, 0]),
        3,
      ),
    );
    geometry.setAttribute(
      "color",
      new THREE.BufferAttribute(
        new Float32Array([1, 1, 1, 1, 0, 0.5, 1, 0.5, 1, 0.4, 0.1, 0]),
        4,
      ),
    );
    scene.add(
      new THREE.Mesh(
        geometry,
        new THREE.MeshBasicMaterial({
          vertexColors: true,
          transparent: true,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      ),
    );

    await renderer.renderAsync(scene, camera);

    renderer.dispose();
    geometry.dispose();
    return true;
  } catch (err) {
    console.warn("[neural] WebGPU present but unusable, falling back", err);
    return false;
  }
};

const hasWebGl2 = (): boolean => {
  try {
    return document.createElement("canvas").getContext("webgl2") !== null;
  } catch {
    return false;
  }
};

export const resolveBackend = (): Promise<GpuTier> => {
  if (!cached) {
    cached = (async (): Promise<GpuTier> => {
      const forced = globalThis.__neuralForcedBackend ?? "auto";

      if (forced === "webgl") {
        return hasWebGl2() ? "webgl2" : "webgl";
      }

      if (forced === "webgpu") {
        return "webgpu";
      }

      if ((await canRequestWebGpuDevice()) && (await webGpuCanDraw())) {
        return "webgpu";
      }

      return hasWebGl2() ? "webgl2" : "webgl";
    })();
  }

  return cached;
};
