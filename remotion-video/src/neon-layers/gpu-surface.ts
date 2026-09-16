import * as THREE from "three/webgpu";

/**
 * An offscreen three.js WebGPU surface that presents through a 2D canvas.
 *
 * Presenting a WebGPU canvas requires the GPU process to allocate a shared
 * swap-chain image that is readable by both Dawn and the compositor. On a
 * machine with no GPU — CI, a container, Remotion's headless renderer — that
 * allocation fails and takes the whole GPU process (and the WebGPU device) with
 * it. Rendering into a `RenderTarget` avoids the swap chain entirely: three
 * only reaches for the canvas context when it draws to the default target, and
 * that context is behind a lazy getter, so it is never created here.
 *
 * Each frame is read back with `copyTextureToBuffer` and blitted into a plain
 * 2D canvas, which is what Remotion screenshots. The readback costs a few
 * milliseconds per megapixel and keeps the pipeline identical on every machine,
 * with or without a GPU.
 */
export type GpuSurface = {
  renderer: THREE.WebGPURenderer;
  renderTarget: THREE.RenderTarget;
  /** Renders via `draw`, then reads the result back onto the 2D canvas. */
  present: (draw: (output: THREE.RenderTarget) => void | Promise<void>) => Promise<void>;
  dispose: () => void;
};

/**
 * Passed to three so an accidental default-target render fails loudly.
 *
 * Typed structurally rather than as `GPUCanvasContext`: the project does not
 * pull in the WebGPU type definitions, and three only ever calls these three
 * methods on it.
 */
const inertCanvasContext = {
  configure: () => undefined,
  unconfigure: () => undefined,
  getCurrentTexture: () => {
    throw new Error(
      "The WebGPU scene tried to draw to the canvas swap chain. Every pass " +
        "must render into the offscreen RenderTarget instead.",
    );
  },
};

export const createGpuSurface = async (
  displayCanvas: HTMLCanvasElement,
  width: number,
  height: number,
  { samples = 4 }: { samples?: number } = {},
): Promise<GpuSurface> => {
  const renderer = new THREE.WebGPURenderer({
    antialias: samples > 0,
    alpha: false,
    context: inertCanvasContext as never,
    forceWebGL: false,
  });
  renderer.setPixelRatio(1);
  renderer.setSize(width, height, false);
  await renderer.init();

  if (!(renderer.backend as { isWebGPUBackend?: boolean }).isWebGPUBackend) {
    throw new Error(
      "three.js fell back to the WebGL backend — no WebGPU adapter was " +
        "available. Launch Chromium with a Vulkan-capable (or SwiftShader) " +
        "adapter; see remotion.config.ts.",
    );
  }

  // sRGB-encoded so the GPU applies the transfer function on write; the bytes
  // read back are then already display-ready and need no CPU conversion.
  // Multisampling belongs on the scene target upstream, not here — this one
  // only ever receives a full-screen composite.
  const renderTarget = new THREE.RenderTarget(width, height, {
    format: THREE.RGBAFormat,
    type: THREE.UnsignedByteType,
    colorSpace: THREE.SRGBColorSpace,
    depthBuffer: false,
    stencilBuffer: false,
    samples: 0,
  });

  const ctx = displayCanvas.getContext("2d", { alpha: false });
  if (!ctx) {
    throw new Error("Could not get a 2D context for the presentation canvas.");
  }

  const rgba = new Uint8ClampedArray(width * height * 4);

  const present = async (
    draw: (output: THREE.RenderTarget) => void | Promise<void>,
  ) => {
    renderer.setRenderTarget(renderTarget);
    await draw(renderTarget);
    renderer.setRenderTarget(null);

    const pixels = (await renderer.readRenderTargetPixelsAsync(
      renderTarget,
      0,
      0,
      width,
      height,
    )) as Uint8Array;

    // WebGPU hands the rows back top-down already, matching ImageData.
    rgba.set(pixels);
    ctx.putImageData(new ImageData(rgba, width, height), 0, 0);
  };

  return {
    renderer,
    renderTarget,
    present,
    dispose: () => {
      renderTarget.dispose();
      renderer.dispose();
    },
  };
};
