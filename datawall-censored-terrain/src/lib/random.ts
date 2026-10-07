// Deterministic randomness. Generators are seeded at module level; nothing here reads a clock.

export const mulberry32 = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

export type Rng = () => number;

export const range = (rng: Rng, a: number, b: number) => a + (b - a) * rng();
export const irange = (rng: Rng, a: number, b: number) => Math.floor(a + (b - a + 1) * rng());
export const pick = <T,>(rng: Rng, arr: readonly T[]): T => arr[Math.floor(rng() * arr.length)];

// Integer hash -> [0, 1). Same formula as the GLSL `hash11u` in shaders.ts.
export const hashU = (x: number) => {
  let h = x >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b) >>> 0;
  h = (h ^ (h >>> 16)) >>> 0;
  return h / 4294967296;
};
