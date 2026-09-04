// A tiny deterministic PRNG (mulberry32). Everything about the board — trace
// routing, component placement, pulse phases — is derived from a fixed seed
// through this, never from Math.random(). Remotion renders frames out of order
// across worker threads, so any per-frame randomness would flicker.
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

/** Uniform in [lo, hi). */
export const between = (rnd: Rng, lo: number, hi: number) => lo + rnd() * (hi - lo);

/** Integer in [lo, hi]. */
export const intBetween = (rnd: Rng, lo: number, hi: number) =>
  lo + Math.floor(rnd() * (hi - lo + 1));

/** Picks an index from a weight table. */
export const weightedIndex = (rnd: Rng, weights: readonly number[]) => {
  let total = 0;
  for (const w of weights) total += w;
  let t = rnd() * total;
  for (let i = 0; i < weights.length; i++) {
    t -= weights[i];
    if (t <= 0) return i;
  }
  return weights.length - 1;
};
