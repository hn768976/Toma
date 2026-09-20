import { Mesh, PerspectiveCamera, Scene, Vector3 } from "three";
import {
  NoToneMapping,
  RenderTarget,
  SRGBColorSpace,
  WebGPURenderer,
} from "three/webgpu";
import { createCycloramaGeometry, createPodiumGeometry } from "./geometry";
import { createStudioMaterials, type StudioMaterials } from "./shading";
import type { StudioSpec } from "./spec";

export interface Rig {
  renderer: WebGPURenderer;
  scene: Scene;
  camera: PerspectiveCamera;
  materials: StudioMaterials;
  /** "webgpu" or "webgl" - which backend actually served the render. */
  backend: string;
  setSize: (width: number, height: number) => void;
  /** Renders one frame and blits it into the 2D canvas Remotion screenshots. */
  renderFrame: (frame: number, durationInFrames: number) => Promise<void>;
  dispose: () => void;
}

/**
 * Builds the three.js side of a variant and initialises a WebGPU renderer.
 *
 * Two deliberate architectural choices here:
 *
 * 1. Rendering goes to an offscreen RenderTarget which is then read back and
 *    blitted into a plain 2D canvas, rather than presenting to a WebGPU canvas
 *    directly. Headless Chrome on a machine with no GPU cannot back a WebGPU
 *    swap chain ("Could not find SharedImageBackingFactory ...
 *    WebgpuSwapChainTexture"), so a presented canvas screenshots as fully
 *    transparent. Going through a render target sidesteps presentation
 *    entirely, and has the side benefit of being bit-deterministic - the frame
 *    Remotion captures is exactly the frame the GPU produced, with no
 *    compositor in between.
 *
 * 2. WebGPURenderer falls back to its own WebGL2 backend when `navigator.gpu`
 *    is missing. The TSL node graph is identical either way; only the compiled
 *    shader language differs (WGSL vs GLSL), so both paths render the same
 *    image.
 */
export const createRig = async (
  canvas: HTMLCanvasElement,
  spec: StudioSpec,
  width: number,
  height: number,
  forceWebGL: boolean,
): Promise<Rig> => {
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) throw new Error("could not acquire a 2D context for blitting");

  // The renderer gets its own detached canvas; nothing is ever presented to it.
  const gpuCanvas = document.createElement("canvas");
  gpuCanvas.width = width;
  gpuCanvas.height = height;

  const renderer = new WebGPURenderer({
    canvas: gpuCanvas,
    antialias: true,
    alpha: false,
    forceWebGL,
  });
  renderer.setPixelRatio(1);
  renderer.setSize(width, height, false);
  renderer.setClearColor(0x000000, 1);
  renderer.toneMapping = NoToneMapping;
  renderer.outputColorSpace = SRGBColorSpace;

  await renderer.init();

  // 4x MSAA on the target: the prop silhouettes are long, near-horizontal
  // curves and alias badly without it.
  const target = new RenderTarget(width, height, { samples: 4 });
  target.texture.colorSpace = SRGBColorSpace;

  const scene = new Scene();

  const camera = new PerspectiveCamera(
    spec.camera.fovDeg,
    width / height,
    0.1,
    200,
  );
  camera.position.set(...spec.camera.position);
  camera.lookAt(new Vector3(...spec.camera.target));

  const materials = createStudioMaterials(spec);

  const cycGeometry = createCycloramaGeometry(spec.cyclorama);
  scene.add(new Mesh(cycGeometry, materials.cyclorama));

  const podGeometry = createPodiumGeometry(spec.podium);
  scene.add(new Mesh(podGeometry, materials.podium));

  // three tags its backends with these flags at runtime, but the public
  // `Backend` type does not declare them.
  const flags = renderer.backend as unknown as { isWebGPUBackend?: boolean };
  const backend = flags?.isWebGPUBackend ? "webgpu" : "webgl";

  let blit: ImageData | null = null;

  return {
    renderer,
    scene,
    camera,
    materials,
    backend,
    setSize: (w: number, h: number) => {
      if (w === target.width && h === target.height) return;
      renderer.setSize(w, h, false);
      target.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      blit = null;
    },
    renderFrame: async (frame: number, durationInFrames: number) => {
      // Phase wraps exactly at the loop point, so frame 0 and frame N match.
      materials.update(frame / durationInFrames, frame * 0.0173);

      renderer.setRenderTarget(target);
      await renderer.renderAsync(scene, camera);
      renderer.setRenderTarget(null);

      const w = target.width;
      const h = target.height;
      const pixels = (await renderer.readRenderTargetPixelsAsync(
        target,
        0,
        0,
        w,
        h,
      )) as Uint8Array;

      if (!blit || blit.width !== w || blit.height !== h) {
        blit = context.createImageData(w, h);
      }
      // Readback already arrives top-down, matching ImageData's row order.
      blit.data.set(pixels);
      // The target has no alpha to speak of, but the 2D canvas honours it.
      for (let i = 3; i < blit.data.length; i += 4) blit.data[i] = 255;

      context.putImageData(blit, 0, 0);
    },
    dispose: () => {
      materials.dispose();
      cycGeometry.dispose();
      podGeometry.dispose();
      target.dispose();
      renderer.dispose();
    },
  };
};
