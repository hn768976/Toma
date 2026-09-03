/**
 * Offscreen canvas helpers and the finishing passes.
 *
 * Bloom is applied per layer rather than once over the composite: each layer
 * owns its own canvas, so the hub can bloom generously while the side chrome
 * barely blooms at all, which is exactly the tonal split the design calls for.
 *
 * Every pass is a pure function of its inputs (grain takes the frame number),
 * so `npx remotion render` produces identical output on every run.
 */
import { makePrng, rand } from "../random/seeded";
import { withAlpha } from "../color/hex";

/** A detached canvas for content that is drawn once and blitted many times. */
export const makeOffscreen = (
  width: number,
  height: number,
): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } => {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.ceil(width));
  canvas.height = Math.max(1, Math.ceil(height));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("node-hub: 2D context unavailable");
  return { canvas, ctx };
};

export type BloomOptions = {
  /** Blur radii in px, in full-frame space. One additive pass per entry. */
  radii: readonly number[];
  /** Alpha of each additive pass. */
  alpha: number;
  /** Where `source` sits in the target canvas. */
  x?: number;
  y?: number;
};

export type Bloom = (
  target: CanvasRenderingContext2D,
  source: HTMLCanvasElement,
  options: BloomOptions,
) => void;

/**
 * Builds a bloom function for sources of a given size.
 *
 * Blur cost scales with the area it is rasterised over, so blurring a 4K layer
 * directly — several times per frame, on every layer — is not affordable. The
 * blur is instead done while downscaling into a small scratch canvas (radius
 * divided to match), and the blurred result is scaled back up additively.
 * Bloom is a wide soft glow, so the lost detail is invisible, and the cost
 * drops by roughly `downscale` squared.
 *
 * The scratch canvas is allocated once and reused, so per-frame drawing does
 * no allocation. `lighter` compositing makes overlapping glows accumulate the
 * way real bloom does.
 */
export const makeBloom = (
  sourceWidth: number,
  sourceHeight: number,
  downscale = 4,
): Bloom => {
  const scratchWidth = Math.max(1, Math.round(sourceWidth / downscale));
  const scratchHeight = Math.max(1, Math.round(sourceHeight / downscale));
  const scratch = makeOffscreen(scratchWidth, scratchHeight);

  return (target, source, { radii, alpha, x = 0, y = 0 }) => {
    target.save();
    target.globalCompositeOperation = "lighter";
    target.globalAlpha = alpha;
    for (const radius of radii) {
      scratch.ctx.setTransform(1, 0, 0, 1, 0, 0);
      scratch.ctx.clearRect(0, 0, scratchWidth, scratchHeight);
      scratch.ctx.filter = `blur(${(radius / downscale).toFixed(3)}px)`;
      scratch.ctx.drawImage(source, 0, 0, scratchWidth, scratchHeight);
      scratch.ctx.filter = "none";
      target.drawImage(scratch.canvas, x, y, sourceWidth, sourceHeight);
    }
    target.restore();
  };
};

/** Darkens the frame corners. `strength` is the corner opacity (0.22 = 22%). */
export const vignettePass = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  strength: number,
  color: string,
): void => {
  const gradient = ctx.createRadialGradient(
    width / 2,
    height / 2,
    Math.min(width, height) * 0.32,
    width / 2,
    height / 2,
    Math.hypot(width, height) * 0.58,
  );
  gradient.addColorStop(0, withAlpha(color, 0));
  gradient.addColorStop(0.62, withAlpha(color, strength * 0.42));
  gradient.addColorStop(1, withAlpha(color, strength));
  ctx.save();
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
};

/** How many distinct noise tiles are cycled through across the loop. */
const GRAIN_TILES = 12;
const GRAIN_TILE_SIZE = 512;

/**
 * Builds the grain tiles.
 *
 * Generating 4K of noise per frame is far too slow, so a small set of seeded
 * tiles is built once and tiled across the frame; the tile and its offset come
 * from the frame number, which keeps the grain moving and makes it repeat
 * exactly on the loop.
 *
 * The noise is SIGNED and carried in the alpha channel — white where it lifts,
 * black where it crushes, opacity proportional to magnitude. That way a plain
 * alpha blit stays tonally neutral. (A "overlay" blend would be the usual
 * trick, but each layer here is its own canvas element, and a blend mode
 * inside one of them has nothing below it to blend against.)
 */
export const makeGrainTiles = (): HTMLCanvasElement[] =>
  Array.from({ length: GRAIN_TILES }, (_, tileIndex) => {
    const { canvas, ctx } = makeOffscreen(GRAIN_TILE_SIZE, GRAIN_TILE_SIZE);
    const image = ctx.createImageData(GRAIN_TILE_SIZE, GRAIN_TILE_SIZE);
    const { data } = image;
    const next = makePrng(`grain/tile/${tileIndex}`);
    for (let i = 0; i < data.length; i += 4) {
      const signed = next() * 2 - 1;
      const level = signed > 0 ? 255 : 0;
      data[i] = level;
      data[i + 1] = level;
      data[i + 2] = level;
      data[i + 3] = Math.round(Math.abs(signed) * 255);
    }
    ctx.putImageData(image, 0, 0);
    return canvas;
  });

/**
 * Lays fine grain over the whole frame at `alpha`. `frame` selects the tile
 * and its offset, seeded from `frame % loopFrames` so grain is identical at
 * both ends of the loop.
 */
export const grainPass = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  frame: number,
  alpha: number,
  tiles: readonly HTMLCanvasElement[],
  /** Loop length; grain repeats on this period so it matches at both ends. */
  loopFrames: number,
): void => {
  const f = frame % loopFrames;
  const tile = tiles[f % tiles.length];
  const pattern = ctx.createPattern(tile, "repeat");
  if (!pattern) return;
  const offsetX = Math.floor(rand(`grain/ox/${f}`) * GRAIN_TILE_SIZE);
  const offsetY = Math.floor(rand(`grain/oy/${f}`) * GRAIN_TILE_SIZE);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(-offsetX, -offsetY);
  ctx.fillStyle = pattern;
  ctx.fillRect(0, 0, width + GRAIN_TILE_SIZE, height + GRAIN_TILE_SIZE);
  ctx.restore();
};

/**
 * Sets up a canvas element for a full-frame layer: sizes the backing store to
 * the real 4K pixel grid and clears it. Returns the context ready to draw.
 */
export const prepareLayer = (
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
): CanvasRenderingContext2D | null => {
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  if (canvas.width !== width) canvas.width = width;
  if (canvas.height !== height) canvas.height = height;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, width, height);
  return ctx;
};
