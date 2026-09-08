/**
 * Seeded PRNG. Every layout decision — rack counts, heights, which racks are
 * left open, LED placement and blink schedules — is drawn from this so that
 * the facility is byte-identical on every render and across threads.
 */

export const mulberry32 = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

export type Rng = () => number;

export const range = (rng: Rng, min: number, max: number) =>
  min + rng() * (max - min);

export const intRange = (rng: Rng, min: number, max: number) =>
  Math.floor(min + rng() * (max - min + 1));

export const pick = <T,>(rng: Rng, items: readonly T[]) =>
  items[Math.floor(rng() * items.length)] as T;

export const chance = (rng: Rng, p: number) => rng() < p;
