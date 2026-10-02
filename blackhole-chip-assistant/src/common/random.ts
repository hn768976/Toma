/**
 * Seeded PRNG. Everything "random" in this project is generated once at
 * module level from a fixed seed, so every render thread sees exactly the
 * same values. Never use Math.random() at render time.
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

export const range = (rand: () => number, min: number, max: number) =>
  min + (max - min) * rand();

export const pick = <T,>(rand: () => number, items: readonly T[]): T =>
  items[Math.floor(rand() * items.length) % items.length];
