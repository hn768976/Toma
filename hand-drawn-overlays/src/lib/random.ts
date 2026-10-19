/**
 * Deterministic randomness. Nothing in this project calls Math.random():
 * every random choice comes from mulberry32 seeded by a string hash
 * (composition id, element id, boil step...).
 */

export type Rng = () => number;

export const mulberry32 = (seed: number): Rng => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/** FNV-1a 32-bit hash of any number of keys. */
export const hash = (...keys: (string | number)[]): number => {
  let h = 0x811c9dc5;
  const s = keys.join("|");
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
};

/** A fresh generator for a named purpose. */
export const rngFor = (...keys: (string | number)[]): Rng => mulberry32(hash(...keys));

/** Module-level generator for one-off layout choices (seeded, never Math.random). */
export const moduleRng = mulberry32(0x5eed1234);

export const range = (rng: Rng, lo: number, hi: number) => lo + (hi - lo) * rng();
export const signed = (rng: Rng, amp: number) => (rng() * 2 - 1) * amp;
export const intRange = (rng: Rng, lo: number, hi: number) =>
  lo + Math.floor(rng() * (hi - lo + 1));

/** Boil steps change every 3 frames. */
export const BOIL_EVERY = 3;
export const boilStep = (frame: number) => Math.floor(frame / BOIL_EVERY);
