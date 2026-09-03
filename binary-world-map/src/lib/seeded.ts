import {random} from "remotion";

/**
 * Deterministic seeded-random helpers built on Remotion's `random()`.
 *
 * Every value is a pure function of its string seed, so a frame rendered on
 * worker 7 out of order is byte-identical to the same frame rendered first in
 * a linear pass. Never use Math.random() or Date.now() in a Remotion tree.
 *
 * @example
 * const x = seededRange("star-3-x", 0, 3840);
 * const kind = seededPick("node-3-kind", ["major", "minor"]);
 */

/** Uniform float in [min, max). */
export const seededRange = (seed: string, min: number, max: number): number =>
  min + random(seed) * (max - min);

/** Uniform integer in [min, max] (inclusive). */
export const seededInt = (seed: string, min: number, max: number): number =>
  Math.floor(min + random(seed) * (max - min + 1 - 1e-9));

/** Uniform element of `items`. */
export const seededPick = <T,>(seed: string, items: readonly T[]): T =>
  items[Math.min(items.length - 1, Math.floor(random(seed) * items.length))];

/** True with probability `p`. */
export const seededChance = (seed: string, p: number): boolean =>
  random(seed) < p;

/**
 * Index into a weighted distribution. `weights` need not sum to 1.
 * Used for "most dim, some mid, a few bright" style distributions.
 */
export const seededWeightedIndex = (
  seed: string,
  weights: readonly number[],
): number => {
  let total = 0;
  for (const w of weights) total += w;
  let r = random(seed) * total;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i];
    if (r < 0) return i;
  }
  return weights.length - 1;
};

/**
 * Sum of two out-of-phase sines. Reads as an organic wobble rather than a
 * metronome because the two periods are deliberately non-harmonic.
 */
export const seededWobble = (
  seed: string,
  frame: number,
  periodA: number,
  periodB: number,
): number => {
  const pa = random(`${seed}-pa`) * Math.PI * 2;
  const pb = random(`${seed}-pb`) * Math.PI * 2;
  return (
    0.62 * Math.sin((frame / periodA) * Math.PI * 2 + pa) +
    0.38 * Math.sin((frame / periodB) * Math.PI * 2 + pb)
  );
};
