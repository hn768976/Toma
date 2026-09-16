/**
 * Presentation surface for the WebGPU renderer.
 *
 * On a machine with a real GPU the browser gives us a WebGPU swap chain and we
 * simply draw into it. Headless Chrome on a GPU-less render box falls back to
 * the SwiftShader adapter, which has no window surface: `configure()` on a
 * `GPUCanvasContext` throws `A valid external Instance reference no longer
 * exists`. Compute and render passes still work there, only *presenting* is
 * missing.
 *
 * So we implement presenting ourselves: a context shim that hands three.js an
 * ordinary render-attachment texture instead of a swap-chain image, and a
 * readback step that copies that texture to a 2D canvas after each frame. The
 * renderer, the node materials and the compute passes are untouched real
 * WebGPU either way — only the final blit differs.
 */

const RENDER_ATTACHMENT_USAGE =
  GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC;

/** `copyTextureToBuffer` requires the row stride to be a multiple of 256. */
const COPY_BYTES_PER_ROW_ALIGNMENT = 256;

const alignUp = (value: number, alignment: number) =>
  Math.ceil(value / alignment) * alignment;

/**
 * `@types/web` already declares a broad `getContext(id: string)` overload that
 * wins over the one `@webgpu/types` merges in, so narrow it here in one place.
 */
const getWebGpuContext = (canvas: HTMLCanvasElement) =>
  canvas.getContext("webgpu") as unknown as GPUCanvasContext | null;

export type PresentationMode = "swapchain" | "readback";

export type Presentation = {
  /** Passed to `WebGPURenderer` as its `context` parameter. */
  readonly context: GPUCanvasContext;
  /** The canvas three.js renders into (its `domElement`). */
  readonly canvas: HTMLCanvasElement;
  /** The canvas that must be in the DOM for Remotion to screenshot. */
  readonly displayCanvas: HTMLCanvasElement;
  readonly mode: PresentationMode;
  /** Called after every `renderAsync()`; a no-op on a real swap chain. */
  present: () => Promise<void>;
  dispose: () => void;
};

/**
 * Minimal `GPUCanvasContext` that three.js can render into without a window
 * surface. It owns a plain texture and keeps handing the same one out.
 */
class OffscreenPresentationContext {
  readonly canvas: HTMLCanvasElement;

  #device: GPUDevice | null = null;
  #format: GPUTextureFormat = "bgra8unorm";
  #texture: GPUTexture | null = null;
  #width = 0;
  #height = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
  }

  get device() {
    return this.#device;
  }

  get format() {
    return this.#format;
  }

  configure(configuration: GPUCanvasConfiguration) {
    this.#device = configuration.device;
    this.#format = configuration.format;
    this.#allocate();
  }

  unconfigure() {
    this.#texture?.destroy();
    this.#texture = null;
  }

  getCurrentTexture(): GPUTexture {
    if (
      this.#texture === null ||
      this.#width !== this.canvas.width ||
      this.#height !== this.canvas.height
    ) {
      this.#allocate();
    }

    // #allocate() throws if there is no device, so this is non-null here.
    return this.#texture as GPUTexture;
  }

  #allocate() {
    if (this.#device === null) {
      throw new Error("Presentation context used before configure()");
    }

    this.#texture?.destroy();
    this.#width = Math.max(1, this.canvas.width);
    this.#height = Math.max(1, this.canvas.height);
    this.#texture = this.#device.createTexture({
      label: "presentation-target",
      size: [this.#width, this.#height, 1],
      format: this.#format,
      usage: RENDER_ATTACHMENT_USAGE,
    });
  }
}

/**
 * Copies the render target into an ImageData and paints it on a 2D canvas.
 * Reuses its staging buffer so a 600 frame render does not churn GPU memory.
 */
class ReadbackPresenter {
  #source: OffscreenPresentationContext;
  #target: CanvasRenderingContext2D;
  #buffer: GPUBuffer | null = null;
  #bufferSize = 0;
  #imageData: ImageData | null = null;

  constructor(
    source: OffscreenPresentationContext,
    displayCanvas: HTMLCanvasElement,
  ) {
    const context = displayCanvas.getContext("2d", { alpha: false });
    if (context === null) {
      throw new Error("Could not create a 2D context for presentation");
    }

    this.#source = source;
    this.#target = context;
  }

  async present() {
    const device = this.#source.device;
    if (device === null) {
      return;
    }

    const texture = this.#source.getCurrentTexture();
    const { width, height } = texture;
    const bytesPerRow = alignUp(width * 4, COPY_BYTES_PER_ROW_ALIGNMENT);
    const size = bytesPerRow * height;

    if (this.#buffer === null || this.#bufferSize !== size) {
      this.#buffer?.destroy();
      this.#buffer = device.createBuffer({
        label: "presentation-readback",
        size,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
      });
      this.#bufferSize = size;
    }

    const encoder = device.createCommandEncoder({ label: "present" });
    encoder.copyTextureToBuffer(
      { texture },
      { buffer: this.#buffer, bytesPerRow, rowsPerImage: height },
      { width, height, depthOrArrayLayers: 1 },
    );
    device.queue.submit([encoder.finish()]);

    await this.#buffer.mapAsync(GPUMapMode.READ);

    if (
      this.#imageData === null ||
      this.#imageData.width !== width ||
      this.#imageData.height !== height
    ) {
      this.#imageData = new ImageData(width, height);
    }

    const source = new Uint32Array(this.#buffer.getMappedRange());
    const destination = new Uint32Array(this.#imageData.data.buffer);
    const sourceStride = bytesPerRow / 4;
    const swizzle = this.#source.format.startsWith("bgra");

    for (let y = 0; y < height; y++) {
      const from = y * sourceStride;
      const to = y * width;

      if (swizzle) {
        // Memory order BGRA -> RGBA: swap the red and blue bytes in place.
        for (let x = 0; x < width; x++) {
          const texel = source[from + x];
          destination[to + x] =
            (texel & 0xff00ff00) |
            ((texel & 0x00ff0000) >>> 16) |
            ((texel & 0x000000ff) << 16);
        }
      } else {
        for (let x = 0; x < width; x++) {
          destination[to + x] = source[from + x];
        }
      }
    }

    this.#buffer.unmap();
    this.#target.putImageData(this.#imageData, 0, 0);
  }

  dispose() {
    this.#buffer?.destroy();
    this.#buffer = null;
  }
}

/**
 * Which presentation path to take.
 *
 * This is decided from the adapter rather than by trying a swap chain and
 * catching the failure: a `configure()` that fails takes the whole Dawn
 * instance down with it, and every later call dies with "Instance dropped".
 * There is no recovering from a failed probe, so we never run one.
 */
export const resolvePresentationMode = (
  adapter: GPUAdapter,
): PresentationMode => {
  const info: Partial<GPUAdapterInfo> = adapter.info ?? {};
  const describes = `${info.vendor ?? ""} ${info.architecture ?? ""} ${
    info.description ?? ""
  }`.toLowerCase();

  const isSoftware =
    describes.indexOf("swiftshader") !== -1 ||
    describes.indexOf("lavapipe") !== -1 ||
    describes.indexOf("llvmpipe") !== -1 ||
    (adapter as { isFallbackAdapter?: boolean }).isFallbackAdapter === true;

  return isSoftware ? "readback" : "swapchain";
};

export const createPresentation = (
  device: GPUDevice,
  width: number,
  height: number,
  mode: PresentationMode,
): Presentation => {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  if (mode === "swapchain") {
    const context = getWebGpuContext(canvas);
    if (context === null) {
      throw new Error("WebGPU canvas context disappeared");
    }

    context.configure({
      device,
      format: navigator.gpu.getPreferredCanvasFormat(),
      alphaMode: "opaque",
    });

    return {
      context,
      canvas,
      displayCanvas: canvas,
      mode: "swapchain",
      present: async () => {
        // The compositor presents the swap chain image for us.
      },
      dispose: () => {
        context.unconfigure();
      },
    };
  }

  const displayCanvas = document.createElement("canvas");
  displayCanvas.width = width;
  displayCanvas.height = height;

  const shim = new OffscreenPresentationContext(canvas);
  const presenter = new ReadbackPresenter(shim, displayCanvas);

  return {
    context: shim as unknown as GPUCanvasContext,
    canvas,
    displayCanvas,
    mode: "readback",
    present: () => presenter.present(),
    dispose: () => {
      presenter.dispose();
      shim.unconfigure();
    },
  };
};

export type RenderDevice = { adapter: GPUAdapter; device: GPUDevice };

export const requestRenderDevice = async (): Promise<RenderDevice> => {
  if (typeof navigator === "undefined" || !navigator.gpu) {
    throw new Error(
      "WebGPU is unavailable. Render with a Chrome build started with " +
        "--enable-unsafe-webgpu (Remotion passes this flag automatically) and " +
        "serve the bundle from a secure context such as http://localhost.",
    );
  }

  const adapter = await navigator.gpu.requestAdapter({
    powerPreference: "high-performance",
  });

  if (adapter === null) {
    throw new Error(
      "No WebGPU adapter available. On a GPU-less machine start Chrome with " +
        "--enable-unsafe-swiftshader so Dawn can use its software adapter.",
    );
  }

  const device = await adapter.requestDevice({ label: "ai-chip-circuit" });

  return { adapter, device };
};
