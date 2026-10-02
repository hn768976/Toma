// Seeded PRNG. Every random value in the project comes from one of these,
// seeded at module level, so a frame is a pure function of its frame number.
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
// Approximate normal distribution (Irwin-Hall, 4 samples).
export const gauss = (rng: Rng) => (rng() + rng() + rng() + rng() - 2) * 1.732;
