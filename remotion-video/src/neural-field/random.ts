// Deterministic PRNG. Remotion renders frames out of order and across
// several browser tabs at once, so every value that looks "random" has to
// come from a fixed seed instead of Math.random(), or particles jump
// between frames.

/** mulberry32 — small, fast, good enough distribution for scatter. */
export const createRandom = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

export type Random = ReturnType<typeof createRandom>;

/** Uniform in [min, max). */
export const between = (rnd: Random, min: number, max: number) =>
  min + rnd() * (max - min);

/**
 * Roughly gaussian via the mean of three uniforms, remapped to [min, max).
 * Used where a hard uniform scatter reads too evenly (particle sizes).
 */
export const bell = (rnd: Random, min: number, max: number) => {
  const t = (rnd() + rnd() + rnd()) / 3;
  return min + t * (max - min);
};

/** Picks an index from a weight table. */
export const weightedIndex = (rnd: Random, weights: number[]) => {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rnd() * total;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i];
    if (r <= 0) return i;
  }
  return weights.length - 1;
};
