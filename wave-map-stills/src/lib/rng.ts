import {random} from "remotion";

/**
 * Every random value in the piece comes from Remotion's `random()`, keyed by
 * the composition's `seed` prop plus a stable string path. Identical props
 * therefore always produce an identical image.
 */
export type Rng = (...path: (string | number)[]) => number;

export const makeRng = (seed: string): Rng => {
  return (...path) => random(`${seed}::${path.join(":")}`);
};

export const range = (r: Rng, lo: number, hi: number, ...path: (string | number)[]) =>
  lo + (hi - lo) * r(...path);

/** Symmetric random in [-1, 1). */
export const signed = (r: Rng, ...path: (string | number)[]) => r(...path) * 2 - 1;
