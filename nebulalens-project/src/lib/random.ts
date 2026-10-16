// Seeded PRNG. Every random layout in the project is generated once, at module
// level, from one of these. Nothing calls Math.random().

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
export const irange = (rng: Rng, lo: number, hi: number) =>
  Math.floor(lo + (hi - lo + 1) * rng());
export const pick = <T,>(rng: Rng, arr: readonly T[]): T => arr[Math.floor(rng() * arr.length)];
