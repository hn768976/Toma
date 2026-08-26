import {random} from 'remotion';

// Every stochastic value in the piece comes through here, so the whole frame is
// a pure function of the frame number and the seed strings below.
// Math.random() is never used.
export const rnd = (seed: string) => random(seed);

export const rrange = (seed: string, min: number, max: number) =>
  min + random(seed) * (max - min);

export const rint = (seed: string, min: number, maxInclusive: number) =>
  min + Math.floor(random(seed) * (maxInclusive - min + 1));

export const pick = <T,>(seed: string, items: readonly T[]): T =>
  items[Math.min(items.length - 1, Math.floor(random(seed) * items.length))];

export const chance = (seed: string, p: number) => random(seed) < p;
