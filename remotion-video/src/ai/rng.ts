// Deterministic pseudo-randomness.
//
// Every frame of a Remotion render is produced independently, often in a
// different browser tab, so Math.random() would give each frame a different
// starfield. All generated content here is seeded instead: the same seed always
// rebuilds the same geometry, which is what makes the renders reproducible.

/** Mulberry32: small, fast, and good enough for scatter and jitter. */
export const makeRng = (seed: number) => {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/** Uniform value in [min, max). */
export const range = (rng: () => number, min: number, max: number) =>
  min + rng() * (max - min);

/** Random pick from a list. */
export const pick = <T,>(rng: () => number, items: readonly T[]): T =>
  items[Math.min(items.length - 1, Math.floor(rng() * items.length))];
