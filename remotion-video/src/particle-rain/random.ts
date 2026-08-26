import { random } from "remotion";

// Every value in the field comes from Remotion's `random()` keyed by a
// stable string. Remotion renders frames out of order across workers, so
// Math.random()/Date.now() would give each worker a different field and the
// video would boil; a string seed gives the same number everywhere, forever.

export const rand = (seed: string): number => random(seed);

export const randRange = (seed: string, min: number, max: number): number =>
  min + random(seed) * (max - min);

export const randSpan = (
  seed: string,
  span: { min: number; max: number },
): number => randRange(seed, span.min, span.max);

export const randInt = (seed: string, min: number, maxInclusive: number): number =>
  min + Math.floor(random(seed) * (maxInclusive - min + 1));

export const randPick = <T>(seed: string, items: readonly T[]): T =>
  items[Math.min(items.length - 1, Math.floor(random(seed) * items.length))];
