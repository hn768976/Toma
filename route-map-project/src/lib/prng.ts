/**
 * Seeded PRNG. Every random-looking value in this project comes from here at
 * module scope or inside a `useMemo`, never from `Math.random()` during a
 * frame: Remotion renders frames out of order across threads, so a frame must
 * be a pure function of `useCurrentFrame()`.
 */

/** FNV-1a, for turning a string id into a 32-bit seed. */
export const hashSeed = (s: string): number => {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
};

/** mulberry32 — small, fast, good enough for placement jitter. */
export const makeRng = (seed: number | string) => {
  let a = (typeof seed === "string" ? hashSeed(seed) : seed) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

export const rngRange = (rng: () => number, lo: number, hi: number) =>
  lo + rng() * (hi - lo);

export const rngInt = (rng: () => number, lo: number, hi: number) =>
  Math.floor(lo + rng() * (hi - lo + 1));

export const rngPick = <T,>(rng: () => number, arr: readonly T[]): T =>
  arr[Math.min(arr.length - 1, Math.floor(rng() * arr.length))];
