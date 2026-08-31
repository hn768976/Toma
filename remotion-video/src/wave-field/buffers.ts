import { HEIGHT, WIDTH, type DepthBucket } from "./constants";

export interface Layer {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
}

export interface Buffers {
  background: Layer;
  mesh: Layer;
  /** One buffer per depth bucket, so each depth is blurred exactly once. */
  depth: Record<DepthBucket, Layer>;
  edge: Layer;
  /** Reduced-resolution scratch used for blur and bloom, keyed by divisor. */
  scratch: Record<number, Layer>;
}

export const SCRATCH_DIVISORS = [2, 4, 8];

const createLayer = (width: number, height: number): Layer => {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D canvas context unavailable");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  return { canvas, ctx };
};

export const createBuffers = (): Buffers => {
  const scratch: Record<number, Layer> = {};
  for (const divisor of SCRATCH_DIVISORS) {
    scratch[divisor] = createLayer(
      Math.ceil(WIDTH / divisor),
      Math.ceil(HEIGHT / divisor),
    );
  }
  return {
    background: createLayer(WIDTH, HEIGHT),
    mesh: createLayer(WIDTH, HEIGHT),
    depth: {
      far: createLayer(WIDTH, HEIGHT),
      mid: createLayer(WIDTH, HEIGHT),
      near: createLayer(WIDTH, HEIGHT),
    },
    edge: createLayer(WIDTH, HEIGHT),
    scratch,
  };
};

const reset = (layer: Layer, driftX: number, driftY: number) => {
  const { ctx } = layer;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.filter = "none";
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
  ctx.clearRect(0, 0, WIDTH, HEIGHT);
  ctx.setTransform(1, 0, 0, 1, driftX, driftY);
};

/**
 * Clears every buffer and applies this frame's field drift. Runs before the
 * layer components draw, so a repeated render redraws identically.
 */
export const prepareBuffers = (buffers: Buffers, driftX: number, driftY: number) => {
  // The ground itself does not drift; everything in the field does.
  reset(buffers.background, 0, 0);
  reset(buffers.mesh, driftX, driftY);
  reset(buffers.depth.far, driftX, driftY);
  reset(buffers.depth.mid, driftX, driftY);
  reset(buffers.depth.near, driftX, driftY);
  reset(buffers.edge, driftX, driftY);
};

export interface CompositeOptions {
  blurPx: number;
  /** Resolution divisor used while blurring. 1 blurs at full resolution. */
  divisor: number;
  alpha: number;
  additive: boolean;
}

/**
 * Draws `source` onto `dest` through a single blur. Large radii are applied at
 * reduced resolution, which is visually equivalent once the image is that soft
 * and keeps a 4K frame affordable.
 */
export const compositeLayer = (
  dest: CanvasRenderingContext2D,
  source: HTMLCanvasElement,
  buffers: Buffers,
  { blurPx, divisor, alpha, additive }: CompositeOptions,
) => {
  dest.setTransform(1, 0, 0, 1, 0, 0);
  dest.globalAlpha = alpha;
  dest.globalCompositeOperation = additive ? "lighter" : "source-over";

  if (divisor <= 1) {
    dest.filter = blurPx > 0 ? `blur(${blurPx}px)` : "none";
    dest.drawImage(source, 0, 0);
    dest.filter = "none";
  } else {
    const layer = buffers.scratch[divisor];
    const { ctx } = layer;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    ctx.filter = "none";
    ctx.clearRect(0, 0, layer.canvas.width, layer.canvas.height);
    ctx.filter = blurPx > 0 ? `blur(${(blurPx / divisor).toFixed(3)}px)` : "none";
    ctx.drawImage(source, 0, 0, layer.canvas.width, layer.canvas.height);
    ctx.filter = "none";

    dest.filter = "none";
    dest.drawImage(layer.canvas, 0, 0, WIDTH, HEIGHT);
  }

  dest.globalAlpha = 1;
  dest.globalCompositeOperation = "source-over";
};
