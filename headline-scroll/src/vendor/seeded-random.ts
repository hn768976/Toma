// Vendored from @studio/remotion-lib (src/seeded-random.ts). Do not edit here —
// edit the library and re-run `node scripts/sync-lib.mjs`.
/**
 * Seeded randomness helpers.
 *
 * Every value derives from Remotion's `random()` with a stable string seed, so
 * anything laid out from these is byte-identical on every machine and every
 * re-render. Math.random() is never used — a render must be reproducible.
 */
import { random } from "remotion";

export const rand = (seed: string): number => random(seed);

export const randRange = (seed: string, min: number, max: number): number =>
  min + random(seed) * (max - min);

export const randInt = (seed: string, min: number, maxInclusive: number): number =>
  min + Math.floor(random(seed) * (maxInclusive - min + 1));

export const pick = <T,>(seed: string, items: readonly T[]): T =>
  items[Math.min(items.length - 1, Math.floor(random(seed) * items.length))];

export const chance = (seed: string, probability: number): boolean =>
  random(seed) < probability;

/** Picks with explicit relative weights. */
export const weighted = <T,>(seed: string, options: readonly [T, number][]): T => {
  const total = options.reduce((sum, [, w]) => sum + w, 0);
  let r = random(seed) * total;
  for (const [value, w] of options) {
    r -= w;
    if (r <= 0) return value;
  }
  return options[options.length - 1][0];
};
