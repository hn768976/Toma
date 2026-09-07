import { random } from "remotion";

/**
 * A deterministic stream of values on top of Remotion's `random()`.
 *
 * Every random number in the piece comes from here, keyed by the `seed` prop,
 * so a given seed always reproduces exactly the same image. `Math.random()` is
 * never used anywhere in this project.
 *
 * The stream is a counter rather than named keys: generation runs in a fixed
 * order, so `${base}#${i}` is stable for a given seed and a given build.
 */
export type Rng = {
  next: () => number;
  range: (min: number, max: number) => number;
  /** Inclusive on both ends. */
  int: (min: number, max: number) => number;
  /** Draws from `[min, max]` biased toward `min` when `bias > 1`. */
  biased: (min: number, max: number, bias: number) => number;
  bool: (probability: number) => boolean;
  pick: <T>(items: readonly T[]) => T;
  /** Roughly normal, mean 0, sd ~0.29. Clamped to [-1, 1] by construction. */
  gauss: () => number;
  /** Picks a key from a weight map; weights need not sum to 1. */
  weighted: <K extends string>(weights: Record<K, number>) => K;
};

export const createRng = (base: string): Rng => {
  let cursor = 0;
  const next = () => random(`${base}#${cursor++}`);

  const range = (min: number, max: number) => min + next() * (max - min);

  const rng: Rng = {
    next,
    range,
    int: (min, max) => Math.min(max, min + Math.floor(next() * (max - min + 1))),
    biased: (min, max, bias) => min + Math.pow(next(), bias) * (max - min),
    bool: (probability) => next() < probability,
    pick: (items) => items[Math.min(items.length - 1, Math.floor(next() * items.length))],
    gauss: () => (next() + next() + next() - 1.5) / 1.5,
    weighted: (weights) => {
      const keys = Object.keys(weights) as (keyof typeof weights)[];
      let total = 0;
      for (const key of keys) total += weights[key];
      let ticket = next() * total;
      for (const key of keys) {
        ticket -= weights[key];
        if (ticket <= 0) return key;
      }
      return keys[keys.length - 1];
    },
  };

  return rng;
};

/** Reads a `[min, max]` config tuple through the stream. */
export const fromRange = (rng: Rng, tuple: readonly [number, number] | readonly number[]) =>
  rng.range(tuple[0], tuple[1]);
