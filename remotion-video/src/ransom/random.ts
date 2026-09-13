// Deterministic, seedable noise. Every random-looking value in the piece
// (crumple silhouettes, stop-motion jitter, fold shading) is derived from an
// integer seed so a given frame always renders byte-identical — required for
// Remotion's distributed/parallel frame rendering.

export const hashRandom = (seed: number): number => {
  let t = (Math.floor(seed) + 0x6d2b79f5) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

export const randRange = (seed: number, min: number, max: number): number =>
  min + hashRandom(seed) * (max - min);
