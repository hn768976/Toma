import {random} from 'remotion';

/**
 * Every stochastic value in the piece comes through here, seeded with a stable
 * string. Math.random() would break `npx remotion render` determinism, since
 * frames are rendered out of order across several browser tabs.
 */
export const seededFloat = (seed: string, min: number, max: number): number =>
  min + random(seed) * (max - min);

export const seededInt = (seed: string, minInclusive: number, maxInclusive: number): number =>
  minInclusive + Math.floor(random(seed) * (maxInclusive - minInclusive + 1));

export const seededBool = (seed: string, probability: number): boolean =>
  random(seed) < probability;

export const seededPick = <T,>(seed: string, items: readonly T[]): T =>
  items[Math.min(items.length - 1, Math.floor(random(seed) * items.length))];

/** Smooth Hermite step, for focus falloff and easing curves. */
export const smoothstep = (edge0: number, edge1: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

export const clamp = (x: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, x));
