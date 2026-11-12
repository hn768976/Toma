// Deterministic seeded PRNG (mulberry32) so every render is frame-exact and repeatable.
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

export const range = (rnd: () => number, min: number, max: number) =>
  min + (max - min) * rnd();

export const pick = <T,>(rnd: () => number, arr: readonly T[]): T =>
  arr[Math.floor(rnd() * arr.length) % arr.length];
