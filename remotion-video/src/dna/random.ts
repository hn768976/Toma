// Deterministic PRNG. Every random value in this project comes from a fixed
// seed so that a frame rendered on one machine matches the next, which is a
// hard requirement for Remotion's parallel frame rendering.

export const mulberry32 = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

export const hashString = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

/** Cheap value noise in 1D, used for hand-drifting camera moves. */
export const noise1 = (x: number, seed = 1337) => {
  const i = Math.floor(x);
  const f = x - i;
  const r = (n: number) => {
    const t = Math.imul(n ^ seed, 0x27d4eb2d);
    return ((t ^ (t >>> 15)) >>> 0) / 4294967296;
  };
  const a = r(i);
  const b = r(i + 1);
  const u = f * f * (3 - 2 * f);
  return a + (b - a) * u;
};

/** Sum of two noise octaves in the range -1..1. */
export const drift = (x: number, seed = 1337) =>
  (noise1(x, seed) - 0.5) * 2 * 0.72 + (noise1(x * 2.31, seed + 991) - 0.5) * 2 * 0.28;
