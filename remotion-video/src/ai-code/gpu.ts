// Renderer-backend selection shared by the three.js and PixiJS layers.
//
// The "AI code" compositions are authored against WebGPU and fall back to
// WebGL2, then WebGL1. Detection happens once per page (a Remotion render
// worker keeps one page alive for many frames) and the result is handed to
// both three.js and Pixi, so a frame is always composited on one backend
// rather than two different ones.

export type GpuBackend = "webgpu" | "webgl2" | "webgl";

let cached: Promise<GpuBackend> | null = null;

const PROBE_TIMEOUT_MS = 4000;

const withTimeout = <T,>(promise: Promise<T>, ms: number): Promise<T | null> =>
  Promise.race([
    promise,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
  ]);

/**
 * Renders one known-colour pixel through WebGPU and reads it back.
 *
 * Asking for an adapter is not enough: headless and software Chromium
 * hand out an adapter and a device, then fail to allocate the canvas
 * swap chain, so every draw silently produces a transparent frame. Only
 * a full configure -> render -> copy -> map round trip catches that, and
 * catching it matters because a whole 300-frame render would otherwise
 * come out blank.
 */
const probeWebGpu = async (): Promise<boolean> => {
  const gpu = (navigator as Navigator & { gpu?: GPU }).gpu;
  if (!gpu) {
    return false;
  }

  let device: GPUDevice | null = null;
  try {
    const adapter = await withTimeout(gpu.requestAdapter(), PROBE_TIMEOUT_MS);
    if (!adapter) {
      return false;
    }
    device = await withTimeout(adapter.requestDevice(), PROBE_TIMEOUT_MS);
    if (!device) {
      return false;
    }

    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    const context = canvas.getContext("webgpu");
    if (!context) {
      return false;
    }
    const format = gpu.getPreferredCanvasFormat();
    context.configure({
      device,
      format,
      alphaMode: "premultiplied",
      // COPY_SRC is what lets the probe read the pixel back out.
      usage:
        GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC,
    });

    // getCurrentTexture() is the call that allocates the swap chain, so
    // this is the line that fails on a broken presentation path.
    const texture = context.getCurrentTexture();
    const readback = device.createBuffer({
      size: 256,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
    });

    const encoder = device.createCommandEncoder();
    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: texture.createView(),
          clearValue: { r: 1, g: 0, b: 0, a: 1 },
          loadOp: "clear",
          storeOp: "store",
        },
      ],
    });
    pass.end();
    encoder.copyTextureToBuffer(
      { texture },
      { buffer: readback, bytesPerRow: 256 },
      { width: 1, height: 1 },
    );
    device.queue.submit([encoder.finish()]);

    // A lost device never settles mapAsync, hence the race.
    const mapped = await Promise.race([
      readback.mapAsync(GPUMapMode.READ).then(() => true),
      device.lost.then(() => false),
      new Promise<boolean>((resolve) =>
        setTimeout(() => resolve(false), PROBE_TIMEOUT_MS),
      ),
    ]);
    if (!mapped) {
      return false;
    }

    const pixel = new Uint8Array(readback.getMappedRange(0, 4));
    // Opaque and saturated on one channel, whichever way round the
    // preferred format orders RGBA vs BGRA.
    const opaque = pixel[3] > 200;
    const saturated = pixel[0] > 200 || pixel[2] > 200;
    readback.unmap();
    readback.destroy();
    return opaque && saturated;
  } catch {
    return false;
  } finally {
    // The probe device is never reused; three and Pixi each request their
    // own. Releasing it keeps the probe from holding a GPU allocation.
    try {
      device?.destroy();
    } catch {
      /* already lost */
    }
  }
};

/** WebGL2 where available, otherwise WebGL1. */
export const detectWebGlBackend = (): GpuBackend => {
  const canvas = document.createElement("canvas");
  return canvas.getContext("webgl2") ? "webgl2" : "webgl";
};

/**
 * Resolves the best backend this browser can actually drive. Cached, so
 * the handshake is paid once per page instead of once per frame.
 */
export const detectGpuBackend = (): Promise<GpuBackend> => {
  if (!cached) {
    cached = probeWebGpu().then((ok) => (ok ? "webgpu" : detectWebGlBackend()));
  }
  return cached;
};

/** Pixi v8 takes a preference and runs its own internal fallback. */
export const pixiPreference = (backend: GpuBackend): "webgpu" | "webgl" =>
  backend === "webgpu" ? "webgpu" : "webgl";
