// Deterministic PRNG (mulberry32). Every per-particle "identity" value —
// fuzz height, size jitter, shimmer phase, brightness jitter — is derived
// from the particle index through this, never from Math.random(). Remotion
// renders frames out of order across worker threads, so anything that is
// not a pure function of (particleIndex, frame) would pop between frames.
export const mulberry32 = (seed: number) => {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};
