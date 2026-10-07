// Deterministic randomness. There is no Math.random() anywhere in this project.
// Everything is either a seeded generator created at module level, or a pure
// integer hash of (indices, frame-derived state).

/** mulberry32 PRNG. Create it at module level with a constant seed. */
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

const mix = (h: number): number => {
  h ^= h >>> 16;
  h = Math.imul(h, 0x7feb352d);
  h ^= h >>> 15;
  h = Math.imul(h, 0x846ca68b);
  h ^= h >>> 16;
  return h >>> 0;
};

/** Order-sensitive 32-bit hash of up to four integers. */
export const hash32 = (a: number, b = 0, c = 0, d = 0): number => {
  let h = mix((a | 0) ^ 0x9e3779b9);
  h = mix(h ^ (b | 0));
  h = mix(h ^ Math.imul(c | 0, 0x85ebca6b));
  h = mix(h ^ Math.imul(d | 0, 0xc2b2ae35));
  return h;
};

/** Hash in [0, 1). */
export const hash01 = (a: number, b = 0, c = 0, d = 0): number => hash32(a, b, c, d) / 4294967296;

const fade = (t: number): number => t * t * t * (t * (t * 6 - 15) + 10);

/** 2D value noise in [0, 1]. */
export const valueNoise2 = (seed: number, x: number, y: number): number => {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = fade(xf);
  const v = fade(yf);
  const a = hash01(seed, xi, yi);
  const b = hash01(seed, xi + 1, yi);
  const c = hash01(seed, xi, yi + 1);
  const d = hash01(seed, xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
};

/**
 * Smooth noise in [-1, 1] that is exactly periodic in `phase` (0..1 is one
 * full loop). It samples 2D value noise around a circle, so phase 0 and
 * phase 1 are the same point and there is no seam. `radius` sets how many
 * features appear around the loop.
 */
export const loopNoise = (seed: number, phase: number, radius = 1.2): number => {
  const a = phase * Math.PI * 2;
  return valueNoise2(seed, 17.3 + radius * Math.cos(a), 91.7 + radius * Math.sin(a)) * 2 - 1;
};
