import { random } from "remotion";

/** Every random value in the piece comes from here, keyed by a stable string. */
export const rnd = (seed: string): number => random(seed);

export const rndRange = (seed: string, min: number, max: number): number =>
  min + random(seed) * (max - min);

export const rndInt = (seed: string, min: number, maxExclusive: number): number =>
  Math.min(maxExclusive - 1, Math.floor(min + random(seed) * (maxExclusive - min)));

export const pick = <T,>(seed: string, arr: readonly T[]): T =>
  arr[Math.min(arr.length - 1, Math.floor(random(seed) * arr.length))];

/** True with probability p. */
export const chance = (seed: string, p: number): boolean => random(seed) < p;
