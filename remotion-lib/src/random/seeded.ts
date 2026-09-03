/**
 * Seeded randomness for deterministic Remotion canvas work.
 *
 * Everything routes through Remotion's `random()` with stable string seeds:
 * Remotion renders frames out of order across workers, so any value derived
 * from Math.random() or Date.now() would differ between neighbouring frames
 * and flicker. A string seed also means a value's identity survives adding or
 * reordering elements, unlike an index into a shared PRNG stream.
 */
import { random } from "remotion";

/** Deterministic value in [0, 1) for `seed`. */
export const rand = (seed: string): number => random(seed);

/** Deterministic value in [min, max). */
export const randRange = (seed: string, min: number, max: number): number =>
  min + random(seed) * (max - min);

/** Deterministic integer in [min, max] inclusive. */
export const randInt = (seed: string, min: number, max: number): number =>
  min + Math.floor(random(seed) * (max - min + 1));

/** Deterministic element of `items`. */
export const pick = <T>(seed: string, items: readonly T[]): T =>
  items[Math.floor(random(seed) * items.length)];

/** True with probability `p`. */
export const chance = (seed: string, p: number): boolean => random(seed) < p;

/** Seeded Fisher-Yates. Returns a new array; `items` is untouched. */
export const shuffled = <T>(seed: string, items: readonly T[]): T[] => {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random(`${seed}/swap/${i}`) * (i + 1));
    const tmp = out[i];
    out[i] = out[j];
    out[j] = tmp;
  }
  return out;
};

/**
 * A fast local PRNG, seeded deterministically from a string seed.
 *
 * `rand()` hashes its string seed on every call, which is the right trade for
 * the few thousand values that define a layout — but not for the millions
 * needed to fill noise tiles. Seeding mulberry32 from a single `random()` draw
 * keeps the result a pure function of the string seed while making bulk
 * generation cheap.
 */
export const makePrng = (seed: string): (() => number) => {
  let state = Math.floor(random(seed) * 0xffffffff) | 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};
