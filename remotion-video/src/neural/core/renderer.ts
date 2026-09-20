/**
 * Renderer factory shared by every three.js layer.
 *
 * `three/webgpu` is built against the same `three.core.js` as the main entry
 * point, so a scene assembled with plain `three` classes can be handed to
 * either renderer without duplicating the class registry.
 *
 * Which backend to use is decided once for the whole page by
 * `resolveBackend()`, including the trial render that proves a WebGPU adapter
 * can actually draw. By the time a layer gets here the answer is already
 * known, so each canvas is created for its final context type directly --
 * important because a canvas can never change context type once it has handed
 * one out.
 *
 *   webgpu -> WebGPURenderer on its WebGPU backend
 *   webgl2 / webgl -> the classic WebGLRenderer, which negotiates WebGL2 with
 *                     a WebGL1 fallback of its own
 */

import type { Camera, Scene } from "three";
import { resolveBackend, type GpuTier } from "./backend";

export type FrameRenderer = {
  readonly tier: GpuTier;
  /** Human-readable backend description, surfaced by the debug HUD. */
  readonly label: string;
  setSize: (width: number, height: number, pixelRatio: number) => void;
  render: (scene: Scene, camera: Camera) => Promise<void>;
  dispose: () => void;
};

const mountCanvas = (host: HTMLElement): HTMLCanvasElement => {
  const canvas = document.createElement("canvas");
  canvas.style.position = "absolute";
  canvas.style.inset = "0";
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  host.appendChild(canvas);
  return canvas;
};

const createWebGpuRenderer = async (
  canvas: HTMLCanvasElement,
): Promise<FrameRenderer> => {
  const { WebGPURenderer } = await import("three/webgpu");

  const renderer = new WebGPURenderer({
    canvas,
    antialias: true,
    alpha: true,
  });

  renderer.setClearColor(0x000000, 0);
  await renderer.init();

  return {
    tier: "webgpu",
    label: "three/webgpu (WebGPU backend)",
    setSize: (width, height, pixelRatio) => {
      renderer.setPixelRatio(pixelRatio);
      renderer.setSize(width, height, false);
    },
    render: async (scene, camera) => {
      await renderer.renderAsync(scene, camera);
    },
    dispose: () => {
      renderer.dispose();
    },
  };
};

const createWebGlRenderer = async (
  canvas: HTMLCanvasElement,
): Promise<FrameRenderer> => {
  const { WebGLRenderer } = await import("three");

  const renderer = new WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    premultipliedAlpha: true,
  });

  renderer.setClearColor(0x000000, 0);

  const isWebGl2 = renderer.capabilities.isWebGL2;

  return {
    tier: isWebGl2 ? "webgl2" : "webgl",
    label: `three WebGLRenderer (${isWebGl2 ? "WebGL2" : "WebGL1"})`,
    setSize: (width, height, pixelRatio) => {
      renderer.setPixelRatio(pixelRatio);
      renderer.setSize(width, height, false);
    },
    render: async (scene, camera) => {
      renderer.render(scene, camera);
    },
    dispose: () => {
      renderer.dispose();
    },
  };
};

export const createFrameRenderer = async (
  host: HTMLElement,
): Promise<FrameRenderer> => {
  const tier = await resolveBackend();

  host.replaceChildren();
  const canvas = mountCanvas(host);

  if (tier === "webgpu") {
    return createWebGpuRenderer(canvas);
  }

  return createWebGlRenderer(canvas);
};
