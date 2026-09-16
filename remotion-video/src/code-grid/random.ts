// Deterministic pseudo-randomness.
//
// Every frame of these compositions is rendered in its own browser tab and
// in arbitrary order, so nothing in the scene may depend on Math.random()
// or on how many frames have been drawn before. The whole field is derived
// from a fixed seed through these helpers, which makes a render byte-stable
// and lets the 1080p and 4K compositions stay in lockstep.

/** Small, fast, well-distributed 32-bit PRNG. */
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

/** Uniform float in [min, max). */
export const range = (rng: Rng, min: number, max: number) =>
  min + rng() * (max - min);

/** Uniform integer in [min, max]. */
export const intRange = (rng: Rng, min: number, max: number) =>
  Math.floor(min + rng() * (max - min + 1));

/** Uniformly picks one entry of a non-empty array. */
export const pick = <T,>(rng: Rng, items: readonly T[]): T =>
  items[Math.floor(rng() * items.length) % items.length];

/** True with probability p. */
export const chance = (rng: Rng, p: number) => rng() < p;
