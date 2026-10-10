import { hash2, mulberry32 } from "./rng";
import { LOOP } from "./constants";

/**
 * Final pass for the two Canvas 2D looks: dither (+-1/255) and film grain.
 *
 * Both come from fixed noise tiles (512 px, tiled) built once from a seeded
 * generator, then read at an offset that is a pure function of `frame % 600`.
 * The result therefore loops with the animation and is the same in every
 * render thread. (The Light Curtain shader does the equivalent with an
 * integer hash of pixel position and frame.)
 */
const TILE = 512;
const MASK = TILE * TILE - 1;

type Tiles = { grain: Float32Array; dither: Float32Array };
const cache = new Map<string, Tiles>();

const getTiles = (coarse: number): Tiles => {
  const key = String(coarse);
  const hit = cache.get(key);
  if (hit) return hit;
  const r = mulberry32(0x6a09e667 + coarse);
  const tri = () => r() + r() - 1; // triangular noise in [-1, 1]
  const raw = new Float32Array(TILE * TILE);
  for (let i = 0; i < raw.length; i++) raw[i] = tri();
  let grain = raw;
  if (coarse > 1) {
    // Horizontally correlated noise (scan-noise feel), wrapped on the tile,
    // re-scaled so its peak stays comparable.
    grain = new Float32Array(TILE * TILE);
    for (let y = 0; y < TILE; y++) {
      for (let x = 0; x < TILE; x++) {
        let s = 0;
        for (let k = 0; k < coarse; k++) s += raw[y * TILE + ((x + k) & (TILE - 1))];
        grain[y * TILE + x] = (s / Math.sqrt(coarse)) * 0.9;
      }
    }
  }
  const dither = new Float32Array(TILE * TILE);
  const r2 = mulberry32(0xbb67ae85);
  for (let i = 0; i < dither.length; i++) dither[i] = r2() - 0.5;
  const tiles = { grain, dither };
  cache.set(key, tiles);
  return tiles;
};

export type FinishOptions = {
  /** Peak grain amplitude as a fraction of full scale (0.02 = 2%). */
  grain: number;
  /** Horizontal correlation length of the grain in pixels (1 = fine). */
  coarse?: number;
  /** Dither amplitude in 8-bit levels (default +-1). */
  dither?: number;
};

export const finishPass = (
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  frame: number,
  opts: FinishOptions,
): void => {
  const f = ((frame % LOOP) + LOOP) % LOOP;
  const { grain, dither } = getTiles(opts.coarse ?? 1);
  const gAmp = opts.grain * 255;
  const dAmp = (opts.dither ?? 1) * 2;
  const ox = hash2(f, 11) & (TILE - 1);
  const oy = hash2(f, 23) & (TILE - 1);
  const dx = hash2(f, 37) & (TILE - 1);
  const dy = hash2(f, 41) & (TILE - 1);
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  let p = 0;
  for (let y = 0; y < h; y++) {
    const gRow = ((y + oy) & (TILE - 1)) * TILE;
    const dRow = ((y + dy) & (TILE - 1)) * TILE;
    for (let x = 0; x < w; x++) {
      const gi = gRow + ((x + ox) & (TILE - 1));
      const di = dRow + ((x + dx) & (TILE - 1));
      const g = grain[gi] * gAmp;
      d[p] += g + dither[di] * dAmp;
      d[p + 1] += g + dither[(di + 87383) & MASK] * dAmp;
      d[p + 2] += g + dither[(di + 174763) & MASK] * dAmp;
      p += 4;
    }
  }
  ctx.putImageData(img, 0, 0);
};
