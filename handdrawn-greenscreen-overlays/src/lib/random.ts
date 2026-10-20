// Deterministic randomness. No Math.random() anywhere in this project.
// Every generator is mulberry32, seeded from a hash of string/number keys
// (composition id, element id, boil step = floor(frame / 3), ...).

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

/** FNV-1a 32-bit hash of the joined keys. */
export const hashKeys = (...keys: (string | number)[]): number => {
  const s = keys.join('|');
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
};

/** Module-level master seed: every generator below derives from it. */
export const MASTER_SEED = hashKeys('handdrawn-greenscreen-overlays', 1);

export type Rng = () => number;

/** A fresh, independent generator for a set of keys. */
export const rngFor = (...keys: (string | number)[]): Rng =>
  mulberry32(hashKeys(MASTER_SEED, ...keys));

export const range = (r: Rng, lo: number, hi: number) => lo + (hi - lo) * r();
export const irange = (r: Rng, lo: number, hi: number) => Math.floor(range(r, lo, hi + 1));
export const signed = (r: Rng, amp: number) => (r() * 2 - 1) * amp;

/** Boil step: points are re-generated every 3 frames. */
export const boilStep = (frame: number) => Math.floor(frame / 3);
/** Movement updates on twos. */
export const onTwos = (frame: number) => Math.floor(frame / 2) * 2;
