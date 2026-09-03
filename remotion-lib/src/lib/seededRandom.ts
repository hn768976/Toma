/**
 * Seeded random helpers.
 *
 * Everything in this project must be a pure function of (seed, frame) so that
 * `remotion render` — which renders frames out of order across workers — is
 * deterministic. These wrap Remotion's `random()`, which hashes a stable
 * string seed. `Math.random()` is never used anywhere.
 */
import { random } from "remotion";

/** Uniform in [0, 1). */
export const rand = (seed: string): number => random(seed);

/** Uniform in [min, max). */
export const randRange = (seed: string, min: number, max: number): number =>
  min + random(seed) * (max - min);

/** Integer in [min, max] inclusive. */
export const randInt = (seed: string, min: number, max: number): number =>
  min + Math.floor(random(seed) * (max - min + 1 - 1e-9));

/** Element of `items`, chosen uniformly. */
export const randPick = <T>(seed: string, items: readonly T[]): T =>
  items[Math.min(items.length - 1, Math.floor(random(seed) * items.length))];

/** -1 or +1. */
export const randSign = (seed: string): number => (random(seed) < 0.5 ? -1 : 1);

/** True with probability `p`. */
export const randChance = (seed: string, p: number): boolean => random(seed) < p;

/**
 * mulberry32 — a fast deterministic PRNG for bulk work (noise tiles) where
 * calling the string-hashing `random()` millions of times would be too slow.
 * Always seed it from `rand()` so the stream still derives from a string seed.
 */
export const mulberry32 = (seed: number): (() => number) => {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};
