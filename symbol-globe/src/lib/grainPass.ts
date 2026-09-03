/**
 * Fine film grain.
 *
 * Writing 8.3 million noise pixels per frame at 4K is far too slow, so a small
 * set of seeded noise tiles is generated once and tiled across the frame. The
 * tile index and its offset both advance with the frame, which breaks up any
 * static pattern; because the tile count divides the loop length and the
 * offsets are seeded on `frame % loopLength`, the grain repeats exactly when
 * the loop does.
 */
import { rand } from "./seededRandom";
import { scratchCanvas } from "./scratchCanvas";

const TILE_SIZE = 512;

const patterns = new Map<string, CanvasPattern>();

const buildTile = (seed: string, index: number): HTMLCanvasElement => {
  const canvas = scratchCanvas(`grain-${seed}-${index}`, TILE_SIZE, TILE_SIZE);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D canvas context unavailable");
  const image = ctx.createImageData(TILE_SIZE, TILE_SIZE);
  const data = image.data;
  // One PRNG draw per pixel would be needlessly slow; a cheap integer hash
  // seeded from the tile's own seeded value gives the same determinism.
  let state = Math.floor(rand(`${seed}-tile-${index}`) * 0xffffffff) >>> 0 || 1;
  for (let i = 0; i < data.length; i += 4) {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    const value = state & 0xff;
    data[i] = value;
    data[i + 1] = value;
    data[i + 2] = value;
    data[i + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
  return canvas;
};

export type GrainOptions = {
  frame: number;
  /** Loop length in frames; grain state repeats on this period. */
  loopLength: number;
  alpha?: number;
  /** Number of distinct tiles. Must divide `loopLength`. */
  tileCount?: number;
  seed?: string;
};

export const grainPass = (
  ctx: CanvasRenderingContext2D,
  options: GrainOptions,
): void => {
  const {
    frame,
    loopLength,
    alpha = 0.04,
    tileCount = 15,
    seed = "grain",
  } = options;

  const loopFrame = ((frame % loopLength) + loopLength) % loopLength;
  const index = loopFrame % tileCount;
  const key = `${seed}-${index}`;

  let pattern = patterns.get(key);
  if (!pattern) {
    const created = ctx.createPattern(buildTile(seed, index), "repeat");
    if (!created) return;
    pattern = created;
    patterns.set(key, pattern);
  }

  const offsetX = Math.floor(rand(`${seed}-ox-${loopFrame}`) * TILE_SIZE);
  const offsetY = Math.floor(rand(`${seed}-oy-${loopFrame}`) * TILE_SIZE);

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = "overlay";
  ctx.globalAlpha = alpha;
  ctx.translate(-offsetX, -offsetY);
  ctx.fillStyle = pattern;
  ctx.fillRect(
    0,
    0,
    ctx.canvas.width + TILE_SIZE,
    ctx.canvas.height + TILE_SIZE,
  );
  ctx.restore();
};
