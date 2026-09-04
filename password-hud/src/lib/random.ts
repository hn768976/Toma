/**
 * Seeded PRNG (mulberry32). Every random value in this project comes from a
 * fixed seed so the background texture is identical on every render and on
 * every thread — Remotion renders frames out of order.
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
  Math.floor(range(rng, min, max + 1));

export const pick = <T,>(rng: Rng, items: readonly T[]): T =>
  items[Math.min(items.length - 1, Math.floor(rng() * items.length))];
