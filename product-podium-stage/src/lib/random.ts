/**
 * Deterministic randomness.
 *
 * Every arrangement in this project (sphere placement, fog offsets, pulse
 * phases) is generated from a seed derived from the look id, never from
 * Math.random and never from state carried between frames. Remotion renders
 * frames out of order across threads, so anything that is not a pure function
 * of the frame number will flicker.
 *
 * A consequence worth keeping: because the seed is keyed on the *look* and not
 * the palette, both palettes of a look produce a pixel-identical arrangement.
 */

/** mulberry32 - small, fast, good enough distribution for layout work. */
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

/** FNV-1a, so a look id string maps to a stable numeric seed. */
export const hashSeed = (input: string): number => {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
};

/** A seeded generator for a look, optionally namespaced per feature. */
export const seededRandom = (lookId: string, namespace = ""): (() => number) =>
  mulberry32(hashSeed(`${lookId}::${namespace}`));

export const randRange = (rng: () => number, min: number, max: number): number =>
  min + rng() * (max - min);
