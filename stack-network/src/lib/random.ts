/**
 * Deterministic pseudo-randomness.
 *
 * Remotion renders frames out of order across several threads, so the
 * layout must be identical in every worker. Everything here is called at
 * module scope (or from pure layout builders) and never during a frame.
 */

/** mulberry32 -- small, fast, good enough distribution for layout. */
export const makeRandom = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

export type Random = ReturnType<typeof makeRandom>;

/** Uniform in [min, max). */
export const between = (rng: Random, min: number, max: number) =>
  min + rng() * (max - min);
