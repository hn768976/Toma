// Deterministic PRNG (mulberry32). Every per-filament / per-particle
// "identity" value is derived from its index through this rather than from
// Math.random(), because Remotion renders frames out of order across
// worker processes — anything that isn't a pure function of
// (index, frame) would flicker between frames.
export const mulberry32 = (seed: number) => {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};
