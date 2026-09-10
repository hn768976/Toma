import { random } from "remotion";

/**
 * Deterministic stream of numbers built on Remotion's `random()`.
 * Math.random() is never used anywhere in this project: the same composition
 * and palette must always produce byte-identical output.
 */
export type Rng = {
  next: () => number;
  range: (min: number, max: number) => number;
  int: (min: number, max: number) => number;
  pick: <T>(items: readonly T[]) => T;
  chance: (p: number) => boolean;
  /** A fresh independent stream, namespaced under this one. */
  fork: (tag: string) => Rng;
};

export const makeRng = (seed: string): Rng => {
  let i = 0;
  const next = () => random(`${seed}#${i++}`) as number;
  return {
    next,
    range: (min, max) => min + next() * (max - min),
    int: (min, max) => Math.floor(min + next() * (max - min + 1)),
    pick: (items) => items[Math.floor(next() * items.length)],
    chance: (p) => next() < p,
    fork: (tag) => makeRng(`${seed}/${tag}`),
  };
};

/** Seed for a composition — stable across palettes so the geometry matches. */
export const compositionSeed = (composition: string, tag: string) =>
  `trading-macro:${composition}:${tag}`;
