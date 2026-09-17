// Gets rendered frames onto a DOM canvas that Remotion can screenshot.
//
// The obvious route — let WebGPURenderer present straight to a <canvas> with a
// `webgpu` context — needs Chromium to allocate a swap chain through its
// shared-image infrastructure. Headless Chromium on a machine with no real GPU
// has no backing factory for that, so `GPUCanvasContext.configure()` fails and,
// worse, takes the whole Dawn instance down with it:
//
//   Could not find SharedImageBackingFactory with params:
//     usage: ...|WebgpuSwapChainTexture, format: BGRA_8888
//   OperationError: Instance dropped in popErrorScope
//
// So we never give three.js a canvas to present to. Every frame is rendered
// into an offscreen RenderTarget, read back, and blitted to a plain 2D canvas.
// three's context getter is lazy and only fires on a render-to-screen, so this
// keeps the WebGPU path fully intact — we are still rendering with WebGPU, just
// not using its presentation path.
//
// Readback of a 1080p frame measures ~9ms here, which is noise next to the
// shader cost, and it makes the project render identically on any machine
// regardless of whether canvas presentation happens to be available.

import * as THREE from "three/webgpu";

export type Presenter = {
  target: THREE.RenderTarget;
  present: () => Promise<void>;
  dispose: () => void;
};

export const createPresenter = (
  renderer: THREE.WebGPURenderer,
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
): Presenter => {
  // The render pipeline already applies tone mapping and the sRGB transfer
  // function when it composites, so the target holds display-ready bytes and
  // must not carry a colour space of its own or they would be encoded twice.
  const target = new THREE.RenderTarget(width, height, {
    format: THREE.RGBAFormat,
    type: THREE.UnsignedByteType,
    colorSpace: THREE.NoColorSpace,
    depthBuffer: true,
    stencilBuffer: false,
    samples: 0,
  });

  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) throw new Error("could not get a 2d context for presentation");

  const rowBytes = width * 4;
  const flipped = new Uint8ClampedArray(rowBytes * height);

  return {
    target,
    present: async () => {
      const pixels = (await renderer.readRenderTargetPixelsAsync(
        target,
        0,
        0,
        width,
        height,
      )) as Uint8Array;

      // Render targets are bottom-up; ImageData is top-down.
      for (let y = 0; y < height; y++) {
        const src = (height - 1 - y) * rowBytes;
        flipped.set(pixels.subarray(src, src + rowBytes), y * rowBytes);
      }

      ctx.putImageData(new ImageData(flipped, width, height), 0, 0);
    },
    dispose: () => {
      target.dispose();
    },
  };
};
