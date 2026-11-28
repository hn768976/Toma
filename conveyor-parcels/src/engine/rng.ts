/**
 * Seeded PRNG. Nothing in this project calls Math.random(): every "random"
 * number comes from a mulberry32 stream created at module level with a fixed
 * seed, so every browser tab that renders a frame builds the identical world.
 */
export const mulberry32 = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

export type Rng = () => number;

export const range = (rng: Rng, lo: number, hi: number) => lo + (hi - lo) * rng();

/** Integer hash -> [0, 1). Stateless, for per-frame values. */
export const hash01 = (n: number, seed = 0) => {
  let x = (Math.imul(n | 0, 0x9e3779b1) ^ Math.imul(seed | 0, 0x85ebca6b)) >>> 0;
  x ^= x >>> 16;
  x = Math.imul(x, 0x7feb352d) >>> 0;
  x ^= x >>> 15;
  x = Math.imul(x, 0x846ca68b) >>> 0;
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
};
