// Seeded PRNG. Every random value in this project comes from here, created at
// module level, so each frame is a pure function of its frame number.
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

export const range = (rng: Rng, min: number, max: number) =>
  min + (max - min) * rng();

export const int = (rng: Rng, min: number, maxInclusive: number) =>
  Math.floor(min + (maxInclusive - min + 1) * rng());

export const pick = <T,>(rng: Rng, items: readonly T[]): T =>
  items[Math.floor(rng() * items.length)];
