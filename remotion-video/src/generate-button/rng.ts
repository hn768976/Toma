/**
 * Deterministic PRNG (mulberry32).
 *
 * Remotion renders frames out of order across worker processes, so every
 * value that describes the scene has to be a pure function of its index —
 * never Math.random() or Date.now(), or the circuit field would re-roll
 * itself and strobe from frame to frame.
 */
export const mulberry32 = (seed: number) => {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

export type Rng = () => number;

export const range = (rng: Rng, min: number, max: number) =>
  min + rng() * (max - min);

export const intRange = (rng: Rng, min: number, max: number) =>
  Math.floor(min + rng() * (max - min + 1));

/** Picks an index from a list of relative weights. */
export const weighted = (rng: Rng, weights: readonly number[]) => {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rng() * total;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i];
    if (r <= 0) return i;
  }
  return weights.length - 1;
};
