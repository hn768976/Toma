// Deterministic PRNG (mulberry32). Everything that looks "random" in this
// clip — ghost sizes, haze-cloud placement, grain — is derived from a fixed
// seed through this, never from Math.random(). Remotion renders frames out
// of order across parallel workers, so anything that isn't a pure function
// of (seed, frame) would flicker between frames.
export const mulberry32 = (seed: number) => {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

// Convenience: a generator that yields values in [min, max).
export const ranged = (rand: () => number) => (min: number, max: number) =>
  min + rand() * (max - min);
