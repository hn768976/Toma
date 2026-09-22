/**
 * Deterministic PRNG. Every random value in this project comes from here, and
 * every draw happens once at module-evaluation time -- never during a render.
 *
 * Remotion renders frames out of order across several threads, so anything
 * drawn per-frame would differ between threads and break the loop.
 */
export const mulberry32 = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/** Uniform float in [min, max). */
export const range = (rng: () => number, min: number, max: number) =>
  min + rng() * (max - min);

/** Integer in [min, max]. */
export const rangeInt = (rng: () => number, min: number, max: number) =>
  Math.floor(min + rng() * (max - min + 1));

/** Pick one element. */
export const pick = <T,>(rng: () => number, items: readonly T[]): T =>
  items[Math.floor(rng() * items.length) % items.length];
