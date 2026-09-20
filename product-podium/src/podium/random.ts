/**
 * Deterministic randomness.
 *
 * Remotion renders frames out of order across threads, so every random value
 * in this project has to be a pure function of a seed — never of a clock, a
 * call order or an accumulator. Everything here is seeded on the look id, so
 * a look's arrangement is stable across frames, across threads and between
 * its two variants.
 */

/** mulberry32 — small, fast, well-distributed 32-bit PRNG. */
export const mulberry32 = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/** Turn a look id into a stable numeric seed. */
export const seedFromString = (s: string) => {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
};

/** Integer hash used by the value-noise below. */
const hash3 = (x: number, y: number, z: number, seed: number) => {
  let h = seed >>> 0;
  h = Math.imul(h ^ (x | 0), 0x27d4eb2d) >>> 0;
  h = Math.imul(h ^ (y | 0), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (z | 0), 0xc2b2ae35) >>> 0;
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
};

const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Smooth 3D value noise in [-1, 1]. */
export const noise3 = (x: number, y: number, z: number, seed = 1) => {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const zi = Math.floor(z);
  const xf = fade(x - xi);
  const yf = fade(y - yi);
  const zf = fade(z - zi);

  const c = (dx: number, dy: number, dz: number) =>
    hash3(xi + dx, yi + dy, zi + dz, seed);

  const x00 = lerp(c(0, 0, 0), c(1, 0, 0), xf);
  const x10 = lerp(c(0, 1, 0), c(1, 1, 0), xf);
  const x01 = lerp(c(0, 0, 1), c(1, 0, 1), xf);
  const x11 = lerp(c(0, 1, 1), c(1, 1, 1), xf);

  const y0 = lerp(x00, x10, yf);
  const y1 = lerp(x01, x11, yf);

  return lerp(y0, y1, zf) * 2 - 1;
};

/** Fractal sum of `noise3`, in roughly [-1, 1]. */
export const fbm3 = (
  x: number,
  y: number,
  z: number,
  octaves = 4,
  seed = 1,
  lacunarity = 2,
  gain = 0.5,
) => {
  let sum = 0;
  let amp = 1;
  let norm = 0;
  let f = 1;
  for (let i = 0; i < octaves; i++) {
    sum += amp * noise3(x * f, y * f, z * f, seed + i * 1013);
    norm += amp;
    amp *= gain;
    f *= lacunarity;
  }
  return sum / norm;
};
