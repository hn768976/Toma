// Renderer bring-up: WebGPU first, WebGL2 as the fallback.
//
// Both paths go through three's WebGPURenderer, so the scene graph, the
// materials and the TSL shader source are identical either way -- only the
// backend differs, and with it whether the shaders are compiled to WGSL or
// to GLSL.
//
// The fallback is deliberately more thorough than an `if (navigator.gpu)`
// check. A browser can advertise WebGPU, hand out an adapter, survive
// renderer.init(), and still fail on the first real render -- headless
// Chrome and a given three.js release routinely disagree about parts of
// the WebGPU surface that are still in flux. So we probe with an actual
// render before committing, and if anything at all goes wrong we throw the
// canvas away and come back up on WebGL2.

import * as THREE from "three/webgpu";

export type Backend = "webgpu" | "webgl2";
export type BackendPreference = "auto" | "webgpu" | "webgl2";

export type RendererHandle = {
  renderer: THREE.WebGPURenderer;
  canvas: HTMLCanvasElement;
  backend: Backend;
};

const webGPUAvailable = () =>
  typeof navigator !== "undefined" &&
  typeof (navigator as Navigator & { gpu?: unknown }).gpu !== "undefined";

const makeCanvas = (
  container: HTMLElement,
  width: number,
  height: number,
): HTMLCanvasElement => {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  canvas.style.display = "block";
  container.appendChild(canvas);
  return canvas;
};

const configure = (
  renderer: THREE.WebGPURenderer,
  width: number,
  height: number,
) => {
  renderer.setPixelRatio(1);
  renderer.setSize(width, height, false);
  // Palette hex is sRGB and gets converted to linear on the way in, so the
  // only job left here is the linear -> sRGB encode on the way out. Tone
  // mapping would quietly crush the glow on the two dark grades.
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
};

/** Renders one throwaway frame to prove the backend actually works. */
const probe = async (renderer: THREE.WebGPURenderer) => {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 10);
  camera.position.z = 3;
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicNodeMaterial({ color: 0x808080 }),
  );
  scene.add(mesh);
  try {
    await renderer.renderAsync(scene, camera);
  } finally {
    mesh.geometry.dispose();
    (mesh.material as THREE.Material).dispose();
  }
};

const tryWebGPU = async (
  container: HTMLElement,
  width: number,
  height: number,
): Promise<RendererHandle | null> => {
  if (!webGPUAvailable()) return null;

  const canvas = makeCanvas(container, width, height);
  let renderer: THREE.WebGPURenderer | null = null;
  try {
    renderer = new THREE.WebGPURenderer({
      canvas,
      antialias: true,
      alpha: false,
      forceWebGL: false,
    });
    await renderer.init();
    configure(renderer, width, height);
    await probe(renderer);
    return { renderer, canvas, backend: "webgpu" };
  } catch (err) {
    console.warn(
      "WebGPU backend unusable, falling back to WebGL2:",
      (err as Error)?.message ?? err,
    );
    try {
      renderer?.dispose();
    } catch {
      // A half-initialised renderer can throw on dispose; nothing to do.
    }
    // The canvas is burnt -- a canvas that has handed out a "webgpu"
    // context will never hand out a "webgl2" one.
    canvas.remove();
    return null;
  }
};

const startWebGL2 = async (
  container: HTMLElement,
  width: number,
  height: number,
): Promise<RendererHandle> => {
  const canvas = makeCanvas(container, width, height);

  // We create the context ourselves rather than letting three do it, purely
  // for preserveDrawingBuffer. Remotion screenshots the page after the
  // browser has composited the frame; without it the drawing buffer may
  // already have been cleared, which comes out as black frames.
  const context = canvas.getContext("webgl2", {
    alpha: false,
    antialias: true,
    depth: true,
    stencil: false,
    preserveDrawingBuffer: true,
    powerPreference: "high-performance",
  });
  if (!context) {
    throw new Error("Neither WebGPU nor WebGL2 is available in this browser.");
  }

  const renderer = new THREE.WebGPURenderer({
    canvas,
    context,
    forceWebGL: true,
    antialias: true,
    alpha: false,
  });
  await renderer.init();
  configure(renderer, width, height);
  return { renderer, canvas, backend: "webgl2" };
};

export const createRenderer = async (
  container: HTMLElement,
  width: number,
  height: number,
  preference: BackendPreference = "auto",
): Promise<RendererHandle> => {
  if (preference !== "webgl2") {
    const gpu = await tryWebGPU(container, width, height);
    if (gpu) return gpu;
    if (preference === "webgpu") {
      throw new Error("WebGPU was requested but is not usable here.");
    }
  }
  return startWebGL2(container, width, height);
};
