// mulberry32, a small deterministic PRNG.
//
// The whole scene — every puff position, star magnitude, twinkle phase —
// is drawn from a seeded sequence rather than Math.random(). Remotion
// renders frames out of order across worker tabs, each of which builds
// the scene independently, so anything non-deterministic would give a
// different layout per tab and shred the video.
//
// Deliberately duplicated from src/particle-ring/ rather than shared, so
// src/cosmos/ stays a self-contained folder you can drop into another
// project on its own.
export const mulberry32 = (seed: number) => {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};
