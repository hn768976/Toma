// Seeded PRNG. Every random value in the scene comes from mulberry32 instances
// created at module level with fixed seeds, so all compositions (and every
// render thread) see the exact same board.
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

export const range = (rng: Rng, a: number, b: number) => a + (b - a) * rng();
export const int = (rng: Rng, a: number, b: number) =>
  Math.floor(range(rng, a, b + 1));
export const pick = <T,>(rng: Rng, arr: readonly T[]): T =>
  arr[Math.floor(rng() * arr.length)];

// One seed for the whole board. Same for every icon.
export const BOARD_SEED = 0x5eed1c0;
export const GLINT_SEED = 0x91171;
