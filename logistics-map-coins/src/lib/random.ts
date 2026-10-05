// Deterministic randomness. Never use Math.random() anywhere in this project:
// Remotion renders frames out of order on several tabs, so every value must be
// a pure function of the frame (and of fixed seeds).

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

export type Rng = ReturnType<typeof mulberry32>;

// Stateless hash -> [0,1). Handy for per-index values that must not depend on
// the order in which they are requested.
export const hash01 = (n: number, seed = 0) => {
  let h = (Math.imul(n | 0, 0x27d4eb2d) ^ Math.imul(seed | 0, 0x165667b1)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

export const range = (rng: Rng, a: number, b: number) => a + (b - a) * rng();
