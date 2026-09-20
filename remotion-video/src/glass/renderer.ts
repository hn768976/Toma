import * as THREE from "three";

/**
 * Which graphics backend actually ended up driving the frame.
 *
 * `webgpu` and `webgl2-node` both come from three's unified `WebGPURenderer`
 * (the second one is its WebGL2 backend, selected with `forceWebGL`), so they
 * share one material path. `webgl-classic` is the last-resort legacy
 * `WebGLRenderer`, used only if `WebGPURenderer` cannot initialise at all.
 */
export type Backend = "webgpu" | "webgl2-node" | "webgl-classic";

export type RendererHandle = {
  backend: Backend;
  /** True when node materials (`three/webgpu`) must be used. */
  useNodeMaterials: boolean;
  setSize: (width: number, height: number) => void;
  render: (scene: THREE.Scene, camera: THREE.Camera) => Promise<void>;
  dispose: () => void;
};

/**
 * Whether WebGPU is both present and actually usable.
 *
 * Presence alone is not enough: Remotion's headless Chromium advertises
 * `navigator.gpu` but cannot allocate a canvas swap chain ("Could not find
 * SharedImageBackingFactory ... WebgpuSwapChainTexture"), so a WebGPU context
 * there dies on the first present. The caller passes `allowWebGPU: false`
 * during CLI renders for that reason, and we additionally confirm that an
 * adapter can be acquired before committing.
 */
const canUseWebGPU = async (allowWebGPU: boolean) => {
  if (!allowWebGPU || typeof navigator === "undefined") {
    return false;
  }
  const gpu = (navigator as Navigator & {
    gpu?: { requestAdapter: () => Promise<unknown | null> };
  }).gpu;
  if (!gpu) {
    return false;
  }
  try {
    return (await gpu.requestAdapter()) !== null;
  } catch {
    return false;
  }
};

export type ToneMappingMode = "aces" | "none";

const TONE_MAPPING: Record<ToneMappingMode, THREE.ToneMapping> = {
  aces: THREE.ACESFilmicToneMapping,
  none: THREE.NoToneMapping,
};

const configureCommon = (
  renderer:
    | THREE.WebGLRenderer
    | { toneMapping: THREE.ToneMapping; toneMappingExposure: number; outputColorSpace: string },
  exposure: number,
  toneMapping: ToneMappingMode,
) => {
  renderer.toneMapping = TONE_MAPPING[toneMapping];
  renderer.toneMappingExposure = exposure;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
};

/**
 * Build the best renderer this browser can give us.
 *
 * Order of preference:
 *   1. `WebGPURenderer` on the WebGPU backend  — used in Chrome/Studio.
 *   2. `WebGPURenderer` with `forceWebGL: true` — WebGL2 backend, same
 *      node-material code path. This is what headless Chromium normally
 *      lands on during a CLI render.
 *   3. Legacy `WebGLRenderer` — only if (2) throws, e.g. a WebGL1-only
 *      context. Uses the classic material path.
 */
export const createRenderer = async (
  canvas: HTMLCanvasElement,
  opts: {
    exposure: number;
    alpha?: boolean;
    allowWebGPU: boolean;
    toneMapping: ToneMappingMode;
  },
): Promise<RendererHandle> => {
  const wantsWebGPU = await canUseWebGPU(opts.allowWebGPU);

  try {
    const { WebGPURenderer } = await import("three/webgpu");
    const renderer = new WebGPURenderer({
      canvas,
      antialias: true,
      alpha: opts.alpha ?? false,
      forceWebGL: !wantsWebGPU,
    });
    await renderer.init();

    configureCommon(renderer as unknown as THREE.WebGLRenderer, opts.exposure, opts.toneMapping);

    // `renderer.backend` tells us which one three actually settled on, which
    // can differ from what we asked for if adapter acquisition failed late.
    const backendName = renderer.backend?.constructor?.name?.toLowerCase() ?? "";
    const isWebGPU = wantsWebGPU && backendName.includes("webgpu");

    return {
      backend: isWebGPU ? "webgpu" : "webgl2-node",
      useNodeMaterials: true,
      setSize: (width, height) => {
        renderer.setPixelRatio(1);
        renderer.setSize(width, height, false);
      },
      render: async (scene, camera) => {
        await renderer.renderAsync(scene, camera);
      },
      dispose: () => {
        renderer.dispose();
      },
    };
  } catch (err) {
    // Fall through to the legacy renderer below.
    console.warn("[glass] WebGPURenderer unavailable, falling back to WebGLRenderer:", err);
  }

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: opts.alpha ?? false,
    // Remotion screenshots the page after we render, so the drawing buffer
    // has to survive past the end of the frame's task.
    preserveDrawingBuffer: true,
    powerPreference: "high-performance",
  });
  configureCommon(renderer, opts.exposure, opts.toneMapping);

  return {
    backend: "webgl-classic",
    useNodeMaterials: false,
    setSize: (width, height) => {
      renderer.setPixelRatio(1);
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
