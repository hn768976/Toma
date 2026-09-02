import { random } from "remotion";

/**
 * Deterministic seeded helpers built on Remotion's `random()`.
 *
 * Every value used by a composition must be a pure function of a stable
 * string seed, never of `Math.random()` or wall-clock time: Remotion
 * renders frames out of order across worker processes, so anything that
 * is not reproducible from the seed alone produces flicker between
 * adjacent frames.
 */

/** Uniform value in [0, 1) for a stable string seed. */
export const rnd = (seed: string): number => random(seed);

/** Uniform value in [min, max) for a stable string seed. */
export const rndRange = (seed: string, min: number, max: number): number =>
  min + random(seed) * (max - min);

/** Uniform integer in [min, max] for a stable string seed. */
export const rndInt = (seed: string, min: number, max: number): number =>
  min + Math.floor(random(seed) * (max - min + 1));

/** Symmetric value in [-spread, spread) for a stable string seed. */
export const rndSigned = (seed: string, spread: number): number =>
  (random(seed) * 2 - 1) * spread;

/** Picks one element of `list` for a stable string seed. */
export const rndPick = <T,>(seed: string, list: readonly T[]): T =>
  list[Math.min(list.length - 1, Math.floor(random(seed) * list.length))];

/**
 * Biased value in [min, max). `bias > 1` crowds results toward `min`,
 * `bias < 1` crowds them toward `max`. Used to make fields denser near a
 * focal point without changing their extent.
 */
export const rndBiased = (
  seed: string,
  min: number,
  max: number,
  bias: number,
): number => min + Math.pow(random(seed), bias) * (max - min);

/** Hermite smoothstep, clamped to [0, 1]. */
export const smoothstep = (edge0: number, edge1: number, x: number): number => {
  if (edge1 === edge0) return x < edge0 ? 0 : 1;
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};

export const clamp = (v: number, min: number, max: number): number =>
  v < min ? min : v > max ? max : v;
