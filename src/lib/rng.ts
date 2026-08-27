import {random} from 'remotion';

/** Every random value in the project comes from here, seeded by a stable string. */
export const rnd = (seed: string): number => random(seed);

export const rndRange = (seed: string, lo: number, hi: number): number =>
  lo + random(seed) * (hi - lo);

export const rndInt = (seed: string, n: number): number =>
  Math.min(n - 1, Math.floor(random(seed) * n));

export const rndPick = <T>(seed: string, arr: readonly T[]): T =>
  arr[rndInt(seed, arr.length)];

/** Symmetric signed value in [-a, a]. */
export const rndSigned = (seed: string, a: number): number =>
  (random(seed) * 2 - 1) * a;
