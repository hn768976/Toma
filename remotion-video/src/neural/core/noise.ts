/**
 * Deterministic noise helpers.
 *
 * Remotion renders frames out of order across threads, so every value that
 * feeds the image has to be reproducible from its inputs alone. Nothing here
 * keeps mutable state between calls.
 */

/** Small, fast, well-distributed 32-bit PRNG. */
export const mulberry32 = (seed: number): (() => number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const hash2 = (x: number, y: number): number => {
  let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

const smooth = (t: number): number => t * t * (3 - 2 * t);

/** Value noise on a 2D lattice, output in [-1, 1]. */
export const noise2 = (x: number, y: number): number => {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;

  const u = smooth(xf);
  const v = smooth(yf);

  const a = hash2(xi, yi);
  const b = hash2(xi + 1, yi);
  const c = hash2(xi, yi + 1);
  const d = hash2(xi + 1, yi + 1);

  const top = a + (b - a) * u;
  const bottom = c + (d - c) * u;
  return (top + (bottom - top) * v) * 2 - 1;
};

/** Fractal sum of `octaves` noise layers, output roughly in [-1, 1]. */
export const fbm2 = (x: number, y: number, octaves = 3): number => {
  let sum = 0;
  let amp = 1;
  let norm = 0;
  let fx = x;
  let fy = y;

  for (let i = 0; i < octaves; i++) {
    sum += noise2(fx, fy) * amp;
    norm += amp;
    amp *= 0.5;
    fx *= 2.03;
    fy *= 1.97;
  }

  return sum / norm;
};

/**
 * Noise around a circle of circumference `period`, so that sampling
 * `t in [0, period)` and wrapping lands back on the identical value. This is
 * what makes the V2 composition loop without a seam.
 */
export const loopNoise = (
  t: number,
  period: number,
  radius: number,
  offset: number,
): number => {
  const angle = (t / period) * Math.PI * 2;
  return fbm2(
    Math.cos(angle) * radius + offset,
    Math.sin(angle) * radius + offset * 0.37,
    3,
  );
};
