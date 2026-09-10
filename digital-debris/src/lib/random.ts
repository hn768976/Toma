/**
 * Deterministic PRNG. Everything in this project must be reproducible from a
 * seed: the element set is generated once at module level and every frame is a
 * pure function of `useCurrentFrame()`, so `Math.random()` is never called at
 * render time.
 */
export const mulberry32 = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

export type Rng = () => number;

export const range = (rng: Rng, min: number, max: number) => min + rng() * (max - min);

/** `rng()` biased towards `min` (power > 1) or `max` (power < 1). */
export const biased = (rng: Rng, min: number, max: number, power: number) =>
  min + Math.pow(rng(), power) * (max - min);

export const pick = <T,>(rng: Rng, items: readonly T[]) =>
  items[Math.min(items.length - 1, Math.floor(rng() * items.length))];

/** Picks an index from `weights` (need not be normalised). */
export const weightedIndex = (rng: Rng, weights: readonly number[]) => {
  let total = 0;
  for (const w of weights) total += w;
  let r = rng() * total;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i];
    if (r <= 0) return i;
  }
  return weights.length - 1;
};

export const clamp = (v: number, min: number, max: number) =>
  v < min ? min : v > max ? max : v;

export const clamp01 = (v: number) => clamp(v, 0, 1);
