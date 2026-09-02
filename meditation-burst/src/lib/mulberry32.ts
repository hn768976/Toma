/**
 * mulberry32 - a tiny deterministic PRNG.
 *
 * Used where a large run of numbers is needed from a single seed (noise
 * tiles, for instance) and calling a per-value seeded hash would be far
 * too slow. Never use it for anything whose value must be reproducible
 * from an index alone.
 */
export const mulberry32 = (seed: number): (() => number) => {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};
