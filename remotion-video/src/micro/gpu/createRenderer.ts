// Renderer selection: WebGPU first, WebGL2 second, WebGL1 last.
//
// three's WebGPURenderer can drive either a real WebGPU device or its own
// WebGL2 backend, so tiers 1 and 2 share a code path and differ only in the
// `forceWebGL` flag. Tier 3 drops to the classic WebGLRenderer, which is the
// only thing that will start on a WebGL1-only context.
//
// Every tier is driven by the same scene graph. That is the reason scenes in
// this project only ever use three's built-in materials: a custom GLSL
// ShaderMaterial would compile on tier 3 and fail on tiers 1 and 2, so surface
// detail is baked into geometry and textures instead of written as shader code.
//
// Each tier is probed with a real draw before it is accepted. Asking whether
// WebGPU exists is not the same as asking whether it works: headless Chrome
// builds regularly expose a `navigator.gpu` that then rejects a descriptor
// three sends it, and that failure only shows up on the first render. Probing
// turns what would be a dead render into a silent step down a tier.

import {
  BoxGeometry,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
  type Camera,
} from "three";
import { WebGPURenderer } from "three/webgpu";

export type RendererTier = "webgpu" | "webgl2" | "webgl";

export interface StageRenderer {
  readonly tier: RendererTier;
  readonly domElement: HTMLCanvasElement;
  render(scene: Scene, camera: Camera): Promise<void>;
  setSize(width: number, height: number, pixelRatio: number): void;
  dispose(): void;
}

// Minimal shape of the bits of navigator.gpu we touch. The full WebGPU types
// are not in this project's lib set, and pulling them in would only be for
// two calls.
interface GPUAdapterLike {
  readonly __brand?: never;
}
interface GPULike {
  requestAdapter(): Promise<GPUAdapterLike | null>;
}

const hasWebGPU = async (): Promise<boolean> => {
  try {
    const gpu = (navigator as Navigator & { gpu?: GPULike }).gpu;
    if (!gpu) return false;
    return (await gpu.requestAdapter()) !== null;
  } catch {
    return false;
  }
};

const hasWebGL2 = (): boolean => {
  try {
    return document.createElement("canvas").getContext("webgl2") !== null;
  } catch {
    return false;
  }
};

/** One real draw, to prove the backend actually works end to end. */
const probeScene = () => {
  const scene = new Scene();
  const camera = new PerspectiveCamera(50, 1, 0.1, 10);
  camera.position.z = 3;
  const mesh = new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial());
  scene.add(mesh);
  return {
    scene,
    camera,
    dispose: () => {
      mesh.geometry.dispose();
      (mesh.material as MeshBasicMaterial).dispose();
    },
  };
};

const configureCommon = (
  renderer: WebGPURenderer | WebGLRenderer,
  width: number,
  height: number,
  pixelRatio: number,
) => {
  renderer.setPixelRatio(pixelRatio);
  renderer.setSize(width, height, false);
  renderer.setClearColor(0x000000, 0);
};

/**
 * Starts a node-based renderer and proves it can draw, returning null rather
 * than throwing so the caller can simply try the next tier.
 */
const tryNodeRenderer = async (
  forceWebGL: boolean,
): Promise<WebGPURenderer | null> => {
  let renderer: WebGPURenderer | null = null;
  const probe = probeScene();
  try {
    renderer = new WebGPURenderer({
      canvas: document.createElement("canvas"),
      antialias: true,
      alpha: true,
      forceWebGL,
    });
    await renderer.init();
    await renderer.renderAsync(probe.scene, probe.camera);
    return renderer;
  } catch {
    try {
      renderer?.dispose();
    } catch {
      // The renderer failed to start; nothing to clean up.
    }
    return null;
  } finally {
    probe.dispose();
  }
};

const wrapNodeRenderer = (
  renderer: WebGPURenderer,
  width: number,
  height: number,
  pixelRatio: number,
): StageRenderer => {
  // `backend.isWebGPUBackend` is the only honest answer about what we actually
  // got; the constructor flag is just a request.
  const tier: RendererTier = (
    renderer.backend as { isWebGPUBackend?: boolean } | undefined
  )?.isWebGPUBackend
    ? "webgpu"
    : "webgl2";

  configureCommon(renderer, width, height, pixelRatio);

  return {
    tier,
    domElement: renderer.domElement as HTMLCanvasElement,
    render: async (scene, camera) => {
      await renderer.renderAsync(scene, camera);
    },
    setSize: (w, h, dpr) => configureCommon(renderer, w, h, dpr),
    dispose: () => renderer.dispose(),
  };
};

/**
 * Builds the best renderer this browser will actually draw with, degrading
 * quietly. `preferred` pins the starting tier, mostly so the fallback paths
 * can be exercised on a machine that does have working WebGPU.
 */
export const createStageRenderer = async ({
  width,
  height,
  pixelRatio,
  preferred = "webgpu",
}: {
  width: number;
  height: number;
  pixelRatio: number;
  preferred?: RendererTier;
}): Promise<StageRenderer> => {
  // Tier 1: real WebGPU.
  if (preferred === "webgpu" && (await hasWebGPU())) {
    const renderer = await tryNodeRenderer(false);
    if (renderer) return wrapNodeRenderer(renderer, width, height, pixelRatio);
  }

  // Tier 2: the node renderer on its WebGL2 backend.
  if (preferred !== "webgl" && hasWebGL2()) {
    const renderer = await tryNodeRenderer(true);
    if (renderer) return wrapNodeRenderer(renderer, width, height, pixelRatio);
  }

  // Tier 3: the classic renderer, the only one that starts on WebGL1.
  const renderer = new WebGLRenderer({ antialias: true, alpha: true });
  configureCommon(renderer, width, height, pixelRatio);

  return {
    tier: "webgl",
    domElement: renderer.domElement,
    render: async (scene, camera) => {
      renderer.render(scene, camera);
    },
    setSize: (w, h, dpr) => configureCommon(renderer, w, h, dpr),
    dispose: () => renderer.dispose(),
  };
};
