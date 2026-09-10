import { random } from "remotion";

/**
 * Deterministic random source.
 *
 * Every random number in the project comes from Remotion's `random()`.
 * `Math.random()` is never used, so a given composition name always produces
 * the identical still — the paper fibres, the stipple dots and the cloud lobes
 * are all reproducible.
 *
 * The stream is counter-based: a numeric base is hashed out of the seed string
 * (which is always derived from the composition name), then each draw hashes
 * `base + n`. Remotion's numeric hashing is uniform and uncorrelated across
 * adjacent seeds, and fast enough to seed millions of grain pixels.
 */
export type Rng = {
  /** Next value in [0, 1). */
  next: () => number;
  /** Next value in [min, max). */
  range: (min: number, max: number) => number;
  /** Next integer in [min, max]. */
  int: (min: number, max: number) => number;
  /** True with probability p. */
  chance: (p: number) => boolean;
  /** Uniform pick from a list. */
  pick: <T>(items: readonly T[]) => T;
  /** Roughly gaussian value, mean 0, range about -1..1. */
  bell: () => number;
};

export const createRng = (seed: string): Rng => {
  const base = Math.floor(random(seed) * 1e9);
  let counter = 0;
  const next = () => random(base + (counter += 1));
  const range = (min: number, max: number) => min + next() * (max - min);
  return {
    next,
    range,
    int: (min: number, max: number) => Math.floor(range(min, max + 1)),
    chance: (p: number) => next() < p,
    pick: <T,>(items: readonly T[]) => items[Math.floor(next() * items.length)],
    bell: () => (next() + next() + next() - 1.5) / 1.5,
  };
};

/** Seeds are always built from the composition name, never from wall time. */
export const seedFor = (composition: string, part: string): string =>
  `washi:${composition}:${part}`;
