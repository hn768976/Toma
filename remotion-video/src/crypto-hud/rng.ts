import { random } from "remotion";

/**
 * Every random value in the piece flows through here, so it is always a pure
 * function of a stable string seed. Math.random() would break determinism
 * across `npx remotion render` workers.
 */

export const rnd = (seed: string) => random(seed);

export const rndRange = (seed: string, min: number, max: number) =>
  min + random(seed) * (max - min);

/** Inclusive of `min`, exclusive of `max`. */
export const rndInt = (seed: string, min: number, max: number) =>
  min + Math.floor(random(seed) * (max - min));

export const rndPick = <T,>(seed: string, items: readonly T[]): T =>
  items[Math.min(items.length - 1, Math.floor(random(seed) * items.length))];

/** A seeded +1 / -1. */
export const rndSign = (seed: string) => (random(seed) < 0.5 ? -1 : 1);
