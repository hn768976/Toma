import { random } from "remotion";

/**
 * Every random value in the piece comes through here, and every seed is a
 * stable string. `Math.random()` is never used: the price series, the grid
 * values and the reroll schedule must be byte-identical on every render.
 */
export const rnd = (seed: string): number => random(seed);

export const rndRange = (seed: string, min: number, max: number): number =>
  min + random(seed) * (max - min);

export const rndInt = (seed: string, min: number, maxExclusive: number): number =>
  min + Math.floor(random(seed) * (maxExclusive - min));

/**
 * A cheap integer PRNG used only for the film grain, where two million values
 * per frame are needed and string hashing would be far too slow. The *seed*
 * still comes from `random()`, so the grain is a pure function of the frame.
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
