// All randomness in the piece goes through Remotion's random(), keyed by a
// stable string seed. Never Math.random(): Remotion renders frames out of
// order across workers, so anything that isn't a pure function of
// (seed, frame) would flicker between frames.

import { random } from "remotion";

export const rand = (seed: string) => random(seed);

export const randRange = (seed: string, min: number, max: number) =>
  min + random(seed) * (max - min);

export const randInt = (seed: string, min: number, maxInclusive: number) =>
  min + Math.floor(random(seed) * (maxInclusive - min + 1));

export const randPick = <T>(seed: string, items: readonly T[]): T =>
  items[Math.min(items.length - 1, Math.floor(random(seed) * items.length))];

export const randSign = (seed: string) => (random(seed) < 0.5 ? -1 : 1);

/** Picks a name from a weighted list. Weights need not sum to exactly 1. */
export const randWeighted = <T extends string>(
  seed: string,
  entries: { name: T; weight: number }[],
): T => {
  const total = entries.reduce((sum, e) => sum + e.weight, 0);
  let roll = random(seed) * total;
  for (const entry of entries) {
    roll -= entry.weight;
    if (roll <= 0) return entry.name;
  }
  return entries[entries.length - 1].name;
};

/** Approximately normal, in [-1, 1]-ish, from three seeded samples. */
export const randGaussian = (seed: string) =>
  (random(`${seed}-a`) + random(`${seed}-b`) + random(`${seed}-c`) - 1.5) / 1.5;
