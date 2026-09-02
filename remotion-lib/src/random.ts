import { random } from "remotion";

/**
 * Deterministic random helpers built on Remotion's `random()`.
 *
 * Remotion renders frames out of order across worker processes, so anything
 * that isn't a pure function of a stable seed will flicker between frames.
 * Nothing here ever touches Math.random() or Date.now().
 */

/** A single draw in [0, 1) from a stable string seed. */
export const rand = (seed: string): number => random(seed);

/** A draw in [min, max). */
export const randRange = (seed: string, min: number, max: number): number =>
  min + random(seed) * (max - min);

/** An integer in [min, max]. */
export const randInt = (seed: string, min: number, max: number): number =>
  Math.floor(min + random(seed) * (max - min + 1 - 1e-9));

/** True with probability `p`. */
export const randChance = (seed: string, p: number): boolean => random(seed) < p;

/** Uniform pick from a list. */
export const randPick = <T,>(seed: string, items: readonly T[]): T =>
  items[Math.floor(random(seed) * items.length) % items.length];

/**
 * An endless stream of draws from one prefix. Use when the number of draws
 * isn't known up front — a rejection sampler, say. The sequence is a pure
 * function of the prefix, so the same prefix always yields the same stream.
 */
export const seededSequence = (prefix: string) => {
  let i = 0;
  const next = () => random(`${prefix}#${i++}`);
  return {
    next,
    range: (min: number, max: number) => min + next() * (max - min),
    /** Approximately normal in [-1, 1] — the mean of three uniform draws. */
    bell: () => ((next() + next() + next()) / 3 - 0.5) * 2,
    /** How many draws have been taken; useful for deriving further seeds. */
    get count() {
      return i;
    },
  };
};
