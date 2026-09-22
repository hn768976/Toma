/**
 * Deterministic PRNG. Every random-looking value in this project comes from
 * here, seeded at module level, so it is identical on every thread and every
 * re-render. Nothing calls Math.random() at render time.
 */
export const mulberry32 = (seed: number): (() => number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

export type Rnd = () => number;

export const range = (rnd: Rnd, lo: number, hi: number) => lo + rnd() * (hi - lo);
export const pick = <T,>(rnd: Rnd, xs: readonly T[]) => xs[Math.floor(rnd() * xs.length) % xs.length];
export const intRange = (rnd: Rnd, lo: number, hi: number) =>
  Math.floor(lo + rnd() * (hi - lo + 1));
