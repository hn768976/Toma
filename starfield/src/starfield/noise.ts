import {gauss, makeRng} from './rng';
import {
  DITHER_MAX,
  DITHER_TILE,
  GRAIN_MEAN,
  GRAIN_SIGMA,
  GRAIN_TILE,
} from './constants';

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const fade = (t: number) => t * t * (3 - 2 * t);

/**
 * Value noise on a wrapped lattice. Because lattice indices are taken modulo
 * `period`, the field tiles exactly at integer multiples of `period` — which is
 * what makes the nebula seamless when we scroll it.
 */
const latticeNoise = (rng: () => number, period: number) => {
  const grid = new Float32Array(period * period);
  for (let i = 0; i < grid.length; i++) grid[i] = rng();

  return (x: number, y: number): number => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const sx = fade(x - xi);
    const sy = fade(y - yi);
    const x0 = ((xi % period) + period) % period;
    const y0 = ((yi % period) + period) % period;
    const x1 = (x0 + 1) % period;
    const y1 = (y0 + 1) % period;
    const r0 = y0 * period;
    const r1 = y1 * period;
    return lerp(
      lerp(grid[r0 + x0], grid[r0 + x1], sx),
      lerp(grid[r1 + x0], grid[r1 + x1], sx),
      sy,
    );
  };
};

/**
 * Tileable fbm over the unit square. Each octave doubles the lattice period, so
 * every octave tiles on the same unit square and therefore so does the sum.
 * Returns values roughly in [0, 1].
 */
export const makeFbm = (seed: string | number, basePeriod = 3, octaves = 5) => {
  const rng = makeRng(seed);
  const layers: {noise: (x: number, y: number) => number; period: number; amp: number}[] = [];
  let amp = 1;
  let norm = 0;
  for (let o = 0; o < octaves; o++) {
    const period = basePeriod * 2 ** o;
    layers.push({noise: latticeNoise(rng, period), period, amp});
    norm += amp;
    amp *= 0.5;
  }
  return (u: number, v: number): number => {
    let sum = 0;
    for (const l of layers) sum += l.amp * l.noise(u * l.period, v * l.period);
    return sum / norm;
  };
};

const smoothstep = (edge0: number, edge1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};

/**
 * Renders a seamlessly tileable cloud texture as a PNG data URL. RGB is white
 * and the shape lives in the alpha channel, so the result can be used directly
 * as a CSS `mask-image` over a colour gradient.
 */
export const makeCloudTileUrl = (
  seed: string | number,
  size = 512,
  lo = 0.4,
  hi = 0.96,
  /** >1 thins the cloud into wisps; 1 leaves the raw smoothstep ramp. */
  gamma = 1,
): string => {
  const fbm = makeFbm(seed, 3, 5);
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  const img = ctx.createImageData(size, size);
  const data = img.data;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const n = fbm(x / size, y / size);
      // The floor opens real gaps and the gamma thins what is left into wisps,
      // so the cloud reads as structure rather than a solid slab.
      const a = smoothstep(lo, hi, n) ** gamma;
      const i = (y * size + x) * 4;
      data[i] = 255;
      data[i + 1] = 255;
      data[i + 2] = 255;
      data[i + 3] = Math.round(a * 255);
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas.toDataURL('image/png');
};

/**
 * Fine additive grain. Values stay near black so a `screen` blend adds texture
 * without lifting the black point into grey.
 */
export const makeGrainTileUrl = (seed: string | number): string => {
  const rng = makeRng(seed);
  const size = GRAIN_TILE;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  const img = ctx.createImageData(size, size);
  const data = img.data;
  for (let i = 0; i < size * size; i++) {
    const v = Math.max(0, Math.min(255, Math.round(GRAIN_MEAN + gauss(rng) * GRAIN_SIGMA)));
    const o = i * 4;
    data[o] = v;
    data[o + 1] = v;
    data[o + 2] = v;
    data[o + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return canvas.toDataURL('image/png');
};

/**
 * Roughly one least-significant bit of uncorrelated noise. Without this a 4K
 * near-black radial gradient bands into visible onion rings.
 */
export const makeDitherTileUrl = (seed: string | number): string => {
  const rng = makeRng(seed);
  const size = DITHER_TILE;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  const img = ctx.createImageData(size, size);
  const data = img.data;
  for (let i = 0; i < size * size; i++) {
    const o = i * 4;
    data[o] = Math.round(rng() * DITHER_MAX);
    data[o + 1] = Math.round(rng() * DITHER_MAX);
    data[o + 2] = Math.round(rng() * DITHER_MAX);
    data[o + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return canvas.toDataURL('image/png');
};
