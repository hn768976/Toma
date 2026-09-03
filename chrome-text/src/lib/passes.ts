/**
 * Post-process passes for canvas pieces: bloom, vignette, film grain and a
 * low-resolution upscale. All are palette-agnostic and deterministic — grain
 * is seeded, everything else is a pure function of its arguments.
 */
import { createCanvas, ctx2d } from "./canvas";
import { rand } from "./random";

/**
 * Draws a small `source` canvas over the full size of `ctx` with high-quality
 * smoothing.
 *
 * Broad soft fields (light pools, haze) cost nothing to compute at 1/8
 * resolution and the upscale is what makes them soft, so this is much cheaper
 * than a large blur at full resolution and looks better.
 */
export const lowResUpscale = (
  ctx: CanvasRenderingContext2D,
  source: HTMLCanvasElement,
  width: number,
  height: number,
): void => {
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, 0, 0, width, height);
  ctx.restore();
};

export type BloomOptions = {
  /** Blur radii to stack, in destination pixels. Wider = softer halo. */
  radii: readonly number[];
  /** Alpha of each blurred copy. */
  alpha: number;
};

/**
 * Adds blurred copies of `source` back over `ctx` with `lighter`, so bright
 * areas bleed into their surroundings the way an over-exposed highlight does.
 * Stacking two or three radii gives a tight core plus a wide halo, which reads
 * far better than one big blur.
 */
export const bloomPass = (
  ctx: CanvasRenderingContext2D,
  source: HTMLCanvasElement,
  { radii, alpha }: BloomOptions,
  dx = 0,
  dy = 0,
  dWidth?: number,
  dHeight?: number,
): void => {
  const w = dWidth ?? source.width;
  const h = dHeight ?? source.height;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const radius of radii) {
    ctx.filter = `blur(${radius}px)`;
    ctx.globalAlpha = alpha;
    ctx.drawImage(source, dx, dy, w, h);
  }
  ctx.restore();
};

/**
 * Darkens the frame toward its corners.
 *
 * `strength` is the fraction of the half-diagonal the falloff occupies: 0.26
 * means the outer 26% ramps to solid black, which is strong enough that a
 * black surround falls away completely and the eye is held in the centre.
 */
export const vignettePass = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  strength: number,
): void => {
  const cx = width / 2;
  const cy = height / 2;
  const radius = Math.hypot(cx, cy);
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
  grad.addColorStop(0, "rgba(0, 0, 0, 0)");
  grad.addColorStop(Math.max(0, 1 - strength * 2), "rgba(0, 0, 0, 0)");
  grad.addColorStop(Math.max(0, 1 - strength), "rgba(0, 0, 0, 0.45)");
  grad.addColorStop(1, "rgba(0, 0, 0, 1)");
  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
};

const noiseTiles = new Map<string, HTMLCanvasElement>();

/**
 * A square tile of seeded monochrome noise, built once and cached.
 *
 * Generating fresh noise for 3840x2160 every frame is far too slow, so the
 * grain pass tiles one large sheet and offsets it per frame instead.
 */
export const noiseTile = (size: number, seed: string): HTMLCanvasElement => {
  const key = `${size}:${seed}`;
  const cached = noiseTiles.get(key);
  if (cached) {
    return cached;
  }
  const canvas = createCanvas(size, size);
  const ctx = ctx2d(canvas);
  const image = ctx.createImageData(size, size);
  const { data } = image;
  for (let i = 0; i < size * size; i++) {
    const v = Math.floor(rand(`${seed}-${i}`) * 256);
    data[i * 4] = v;
    data[i * 4 + 1] = v;
    data[i * 4 + 2] = v;
    data[i * 4 + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
  noiseTiles.set(key, canvas);
  return canvas;
};

export type GrainOptions = {
  /** Frame number. The pass repeats with `period`, keeping a loop seamless. */
  frame: number;
  period: number;
  /** Grain strength. ~0.04 is a fine, filmic amount. */
  alpha: number;
  /** Size of one noise pixel on screen. 2 keeps grain fine at 4K. */
  scale?: number;
  /** Edge of the cached noise sheet. */
  tileSize?: number;
};

/**
 * Paints a self-contained film-grain sheet filling `ctx`.
 *
 * The sheet is neutral mid-grey modulated by seeded noise, and is meant to be
 * composited over the picture with `mix-blend-mode: overlay`. Mid-grey is
 * overlay's identity, so `alpha` is literally how far the grain pushes each
 * pixel: 0.04 gives a 4% modulation. Doing it this way rather than laying
 * translucent noise over the frame means the grain never lifts the blacks.
 *
 * The noise is seeded on `frame % period`, so it animates but repeats exactly
 * once per loop.
 */
export const grainPass = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  { frame, period, alpha, scale = 2, tileSize = 512 }: GrainOptions,
): void => {
  const tile = noiseTile(tileSize, "grain-sheet");
  const step = tileSize * scale;
  const phase = ((frame % period) + period) % period;
  // Offsetting the same sheet per frame is what makes the grain move. The
  // offsets come from the seeded RNG, so they are identical on every render.
  const offsetX = -Math.floor(rand(`grain-x-${phase}`) * step);
  const offsetY = -Math.floor(rand(`grain-y-${phase}`) * step);

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
  ctx.filter = "none";
  ctx.fillStyle = "rgb(128, 128, 128)";
  ctx.fillRect(0, 0, width, height);

  ctx.globalAlpha = alpha;
  ctx.imageSmoothingEnabled = false;
  for (let y = offsetY; y < height; y += step) {
    for (let x = offsetX; x < width; x += step) {
      ctx.drawImage(tile, x, y, step, step);
    }
  }
  ctx.restore();
};
