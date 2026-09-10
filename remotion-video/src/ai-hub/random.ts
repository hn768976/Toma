// mulberry32, the same tiny deterministic PRNG the particle-ring clip
// uses. Everything with a random-looking value in this composition
// (spoke angles, node radii, icon assignment, shimmer phases) is drawn
// from here once at module load, never at render time: Remotion renders
// frames out of order across worker threads, so a Math.random() call
// inside a component would make the geometry flicker frame to frame.
export const mulberry32 = (seed: number) => {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};
