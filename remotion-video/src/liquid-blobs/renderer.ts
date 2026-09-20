import * as THREE from "three/webgpu";

export type RendererBackend = "webgpu" | "webgl2" | "webgl";

export type RendererPreference = "auto" | RendererBackend;

export type CreatedRenderer = {
  renderer: THREE.WebGPURenderer;
  backend: RendererBackend;
  /** Why we ended up on this backend — surfaced in the studio overlay. */
  note: string;
};

/**
 * three.js' WebGPURenderer is backend-agnostic: it drives WebGPU where that
 * is available and a WebGL2 context otherwise, from the same node graph. We
 * still probe explicitly rather than trusting auto-detection, because a
 * browser can advertise `navigator.gpu` and hand out an adapter while the
 * underlying device is unusable — which is exactly what happens on a headless
 * machine with no GPU, where Dawn drops the instance at first draw.
 */

/**
 * Markers for adapters that are CPU rasterisers wearing a GPU's clothes.
 * Headless Chromium reports one of these when no real device is present.
 */
const SOFTWARE_ADAPTER_MARKERS = [
  "swiftshader",
  "llvmpipe",
  "lavapipe",
  "softwarerasterizer",
  "basic render driver",
];

type AdapterLike = {
  info?: { vendor?: string; architecture?: string; device?: string; description?: string };
  isFallbackAdapter?: boolean;
};

const probeAdapter = async (): Promise<string | null> => {
  const gpu = (
    navigator as Navigator & {
      gpu?: { requestAdapter: (options?: unknown) => Promise<AdapterLike | null> };
    }
  ).gpu;
  if (!gpu) {
    return "navigator.gpu is not exposed";
  }
  let adapter: AdapterLike | null;
  try {
    adapter = await gpu.requestAdapter({ powerPreference: "high-performance" });
  } catch (err) {
    return `adapter request failed: ${String(err)}`;
  }
  if (!adapter) {
    return "no WebGPU adapter available";
  }
  if (adapter.isFallbackAdapter) {
    return "adapter is a fallback adapter";
  }
  const info = adapter.info ?? {};
  const fingerprint = [
    info.vendor,
    info.architecture,
    info.device,
    info.description,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const software = SOFTWARE_ADAPTER_MARKERS.find((marker) =>
    fingerprint.includes(marker),
  );
  if (software) {
    // A software WebGPU device is not worth taking: it is markedly slower
    // than the WebGL2 path the same rasteriser already serves, and on a
    // headless host it tends to drop its instance mid-submit.
    return `adapter is software (${software})`;
  }
  return null;
};

/**
 * Dawn reports some device failures out of band, as a rejected promise no
 * caller is awaiting. Remotion fails a render on any unhandled rejection, so
 * the probe runs with those suppressed — a WebGPU error raised while we are
 * deciding whether WebGPU works is a result, not a crash.
 */
const withRejectionsSuppressed = async <T,>(fn: () => Promise<T>): Promise<T> => {
  const swallow = (event: PromiseRejectionEvent | ErrorEvent) => {
    event.preventDefault();
  };
  window.addEventListener("unhandledrejection", swallow);
  window.addEventListener("error", swallow);
  try {
    return await fn();
  } finally {
    // Give Dawn a turn of the event loop to surface anything late.
    await new Promise((resolve) => setTimeout(resolve, 0));
    window.removeEventListener("unhandledrejection", swallow);
    window.removeEventListener("error", swallow);
  }
};

const detectBackend = (renderer: THREE.WebGPURenderer): RendererBackend => {
  const backend = renderer.backend as unknown as {
    isWebGPUBackend?: boolean;
    gl?: WebGL2RenderingContext | WebGLRenderingContext;
  };
  if (backend.isWebGPUBackend) {
    return "webgpu";
  }
  const gl = backend.gl;
  if (
    typeof WebGL2RenderingContext !== "undefined" &&
    gl instanceof WebGL2RenderingContext
  ) {
    return "webgl2";
  }
  return "webgl";
};

const configure = (renderer: THREE.WebGPURenderer) => {
  // The shader writes final, already-graded linear values. Any tone curve on
  // top of that would pull the flat backdrop off its sampled colour, so the
  // only transform we want is linear to sRGB on output.
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x000000, 1);
};

/**
 * A WebGPU device can initialise cleanly and only fail once it is asked to
 * draw — a headless machine with no GPU reports an adapter and then drops the
 * Dawn instance at the first submit. So `init()` is not trusted on its own;
 * we draw one throwaway frame and treat that as the real capability test.
 *
 * The probe runs on its own canvas. A canvas can only ever hand out one kind
 * of context, so probing on the canvas we actually want to draw into would
 * leave it claimed by WebGPU and unable to fall back to WebGL.
 */
const probeRender = async (renderer: THREE.WebGPURenderer) => {
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.MeshBasicNodeMaterial({ color: 0x000000 }),
  );
  scene.add(mesh);
  try {
    renderer.setSize(8, 8, false);
    await renderer.renderAsync(scene, camera);
  } finally {
    mesh.geometry.dispose();
    (mesh.material as THREE.Material).dispose();
  }
};

let webgpuSupport: Promise<string | null> | null = null;

/** Resolves to null when WebGPU is usable, or to the reason it is not. */
const checkWebGPU = (): Promise<string | null> => {
  webgpuSupport ??= withRejectionsSuppressed(async () => {
    const blocked = await probeAdapter();
    if (blocked) {
      return blocked;
    }
    let renderer: THREE.WebGPURenderer | null = null;
    try {
      renderer = new THREE.WebGPURenderer({
        canvas: document.createElement("canvas"),
        antialias: false,
        alpha: false,
        forceWebGL: false,
      });
      await renderer.init();
      if (!detectBackend(renderer).startsWith("webgpu")) {
        return "three selected a WebGL backend";
      }
      await probeRender(renderer);
      return null;
    } catch (err) {
      return `probe render failed: ${String(err)}`;
    } finally {
      renderer?.dispose();
    }
  });
  return webgpuSupport;
};

/**
 * Creates a renderer, preferring WebGPU and falling back through WebGL2 to
 * WebGL. A forced preference is honoured if it works and otherwise falls
 * through, so pinning a backend can never leave the render blank.
 */
export const createRenderer = async (
  canvas: HTMLCanvasElement,
  preference: RendererPreference = "auto",
): Promise<CreatedRenderer> => {
  const notes: string[] = [];
  let forceWebGL = true;

  if (preference === "auto" || preference === "webgpu") {
    const blocked = await checkWebGPU();
    if (blocked) {
      notes.push(`WebGPU unavailable (${blocked})`);
    } else {
      forceWebGL = false;
    }
  } else {
    notes.push(`${preference} requested`);
  }

  const renderer = new THREE.WebGPURenderer({
    canvas,
    antialias: false, // silhouettes come from the shader; MSAA cannot see them
    alpha: false,
    forceWebGL,
    powerPreference: "high-performance",
  });
  await renderer.init();
  configure(renderer);

  const backend = detectBackend(renderer);
  notes.unshift(`using ${backend}`);
  return { renderer, backend, note: notes.join("; ") };
};
