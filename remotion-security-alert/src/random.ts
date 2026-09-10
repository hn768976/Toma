/**
 * Seeded PRNG (mulberry32). Remotion renders frames out of order across
 * threads, so every piece of "random" background content has to be a pure
 * function of its seed — never of call order or of a module-level counter.
 */

export const mulberry32 = (seed: number): (() => number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/** Stable 32-bit hash of a string, for turning a label into a seed. */
export const hashSeed = (key: string): number => {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

export const rngFor = (key: string): (() => number) => mulberry32(hashSeed(key));

export const pick = <T>(rand: () => number, list: readonly T[]): T =>
  list[Math.floor(rand() * list.length) % list.length];

export const randInt = (rand: () => number, min: number, max: number): number =>
  min + Math.floor(rand() * (max - min + 1));
