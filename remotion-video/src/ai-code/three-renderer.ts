import * as THREE from "three";
import { detectGpuBackend, detectWebGlBackend, type GpuBackend } from "./gpu";

// A thin uniform wrapper over three's two renderers. WebGPU draws through
// `renderAsync`, WebGL through the synchronous `render`, so callers always
// await the result and stay backend-agnostic.
export type SceneRenderer = {
  backend: GpuBackend;
  canvas: HTMLCanvasElement;
  setSize: (width: number, height: number) => void;
  render: (scene: THREE.Scene, camera: THREE.Camera) => Promise<void>;
  dispose: () => void;
};

// three's WebGPURenderer cannot compile raw GLSL, so every scene in this
// project is built from core materials only (Mesh/Line/Points/Sprite
// basic). Those are translated to node materials automatically, which is
// what keeps one scene definition valid on both backends.
export const createSceneRenderer = async (
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
): Promise<SceneRenderer> => {
  const preferred = await detectGpuBackend();

  if (preferred === "webgpu") {
    try {
      const { WebGPURenderer } = await import("three/webgpu");
      const renderer = new WebGPURenderer({
        canvas,
        antialias: true,
        alpha: true,
      });
      await renderer.init();
      renderer.setPixelRatio(1);
      renderer.setSize(width, height, false);
      renderer.setClearColor(0x000000, 0);
      return {
        backend: "webgpu",
        canvas,
        setSize: (w, h) => renderer.setSize(w, h, false),
        render: (scene, camera) => renderer.renderAsync(scene, camera),
        dispose: () => renderer.dispose(),
      };
    } catch (err) {
      // An adapter that answers the probe but dies on first use still has
      // to produce a frame, so drop to WebGL rather than failing the render.
      console.warn("WebGPU renderer unavailable, falling back to WebGL", err);
    }
  }

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(1);
  renderer.setSize(width, height, false);
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  return {
    backend: preferred === "webgpu" ? detectWebGlBackend() : preferred,
    canvas,
    setSize: (w, h) => renderer.setSize(w, h, false),
    render: async (scene, camera) => {
      renderer.render(scene, camera);
    },
    dispose: () => renderer.dispose(),
  };
};
