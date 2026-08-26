import { random } from 'remotion';
import { CONFIG, HEIGHT, WIDTH } from '../config';
import { alpha, ctx2d, makeCanvas } from '../plane';
import type { Variant } from '../variants';

/** Deterministic PRNG for bulk texture, seeded from Remotion's random(). */
const mulberry32 = (seed: number) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

/** A handful of monochrome noise tiles, cycled by frame number. */
export const bakeGrain = (id: string): HTMLCanvasElement[] =>
  Array.from({ length: CONFIG.grainTiles }, (_, i) => {
    const size = CONFIG.grainTileSize;
    const c = makeCanvas(size, size);
    const ctx = ctx2d(c);
    const img = ctx.createImageData(size, size);
    const rnd = mulberry32(Math.floor(random(`grain-${id}-${i}`) * 2 ** 31));
    for (let px = 0; px < size * size; px++) {
      const v = (rnd() * 255) | 0;
      img.data[px * 4] = v;
      img.data[px * 4 + 1] = v;
      img.data[px * 4 + 2] = v;
      img.data[px * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    return c;
  });

/** Background wash: deep at the corners, a touch lighter through the focal band. */
export const bakeBackground = (v: Variant): HTMLCanvasElement => {
  const c = makeCanvas(WIDTH, HEIGHT);
  const ctx = ctx2d(c);
  const p = v.palette;
  ctx.fillStyle = p.backgroundDeep;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  const g = ctx.createRadialGradient(
    WIDTH * 0.42,
    HEIGHT * 0.46,
    0,
    WIDTH * 0.42,
    HEIGHT * 0.46,
    WIDTH * 0.72
  );
  g.addColorStop(0, alpha(p.backgroundMid, 0.95));
  g.addColorStop(0.55, alpha(p.backgroundMid, 0.4));
  g.addColorStop(1, alpha(p.backgroundDeep, 0));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  return c;
};

export const drawVignette = (ctx: CanvasRenderingContext2D, v: Variant) => {
  const g = ctx.createRadialGradient(
    WIDTH / 2,
    HEIGHT / 2,
    HEIGHT * 0.34,
    WIDTH / 2,
    HEIGHT / 2,
    WIDTH * 0.74
  );
  g.addColorStop(0, alpha(v.palette.backgroundDeep, 0));
  g.addColorStop(1, alpha(v.palette.backgroundDeep, CONFIG.vignette * 3.2));
  ctx.globalAlpha = 1;
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
};

export const drawGrain = (
  ctx: CanvasRenderingContext2D,
  tiles: HTMLCanvasElement[],
  frame: number
) => {
  const tile = tiles[frame % tiles.length];
  const pattern = ctx.createPattern(tile, 'repeat');
  if (!pattern) return;
  ctx.globalCompositeOperation = 'overlay';
  ctx.globalAlpha = CONFIG.grainAlpha;
  ctx.fillStyle = pattern;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
};
