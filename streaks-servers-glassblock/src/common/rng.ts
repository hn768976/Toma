// Deterministic PRNG. Every random layout in the project is drawn from a
// mulberry32 stream seeded at module level, so all render threads and all
// frames see exactly the same values. Math.random() is never used.
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

export const range = (rng: Rng, lo: number, hi: number) => lo + (hi - lo) * rng();
export const pick = <T,>(rng: Rng, arr: readonly T[]): T =>
  arr[Math.floor(rng() * arr.length) % arr.length];
