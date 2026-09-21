/**
 * Deterministic randomness.
 *
 * Every value that ends up on screen is drawn from one of these at BUILD
 * time -- never during a render. Remotion renders frames out of order across
 * several threads, so anything drawn at render time would differ per frame.
 */

export type Rng = () => number;

export const mulberry32 = (seed: number): Rng => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/** Uniform in [min, max). */
export const range = (rng: Rng, min: number, max: number) =>
  min + rng() * (max - min);

/** Integer in [min, max] inclusive. */
export const rangeInt = (rng: Rng, min: number, max: number) =>
  Math.floor(min + rng() * (max - min + 1));

/** Roughly normal, mean 0, sd 1 -- three uniforms is close enough here. */
export const gaussian = (rng: Rng) => (rng() + rng() + rng() - 1.5) * 1.1547;

export const pick = <T,>(rng: Rng, items: readonly T[]): T =>
  items[Math.floor(rng() * items.length) % items.length];
