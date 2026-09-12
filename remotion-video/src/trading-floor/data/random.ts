// Deterministic pseudo-randomness. Every frame of the video is a pure
// function of the frame number, so the same composition always renders
// the same pixels — required for distributed / resumable rendering and
// for the 1080p and 4K outputs to match exactly.

export const mulberry32 = (seed: number): (() => number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

// Stateless hash noise in [0,1), for "what does cell (i,j) look like"
// lookups that must not depend on iteration order.
export const noise2 = (i: number, j: number, seed = 0): number => {
  let h = (Math.imul(i, 0x27d4eb2d) ^ Math.imul(j, 0x165667b1) ^ seed) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) >>> 0;
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39) >>> 0;
  return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
};

export const randInt = (rnd: () => number, min: number, max: number): number =>
  min + Math.floor(rnd() * (max - min + 1));

export const pick = <T>(rnd: () => number, arr: readonly T[]): T =>
  arr[Math.floor(rnd() * arr.length)];

// Linear interpolation through a sorted list of {x, y} control points.
export const piecewise = (
  points: readonly { x: number; y: number }[],
  x: number,
): number => {
  if (x <= points[0].x) return points[0].y;
  const last = points[points.length - 1];
  if (x >= last.x) return last.y;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    if (x <= b.x) {
      const t = (x - a.x) / (b.x - a.x);
      return a.y + (b.y - a.y) * t;
    }
  }
  return last.y;
};
