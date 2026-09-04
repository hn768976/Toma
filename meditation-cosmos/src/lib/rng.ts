/**
 * Deterministic randomness.
 *
 * Remotion renders frames out of order and across several threads, so nothing
 * may depend on `Math.random()` or on state carried between frames. Every
 * random-looking quantity in this project comes from one of these seeded
 * helpers, which return the same value for the same seed on every call.
 */

/** Classic mulberry32 PRNG — fast, and good enough for layout scatter. */
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

/** Integer hash of two coordinates plus a seed, returned in [0, 1). */
export const hash2 = (x: number, y: number, seed: number) => {
  let h = Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(y | 0, 0x165667b1) ^ Math.imul(seed | 0, 0x9e3779b9);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

export const clamp = (v: number, lo = 0, hi = 1) => (v < lo ? lo : v > hi ? hi : v);

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export const smoothstep = (edge0: number, edge1: number, x: number) => {
  const t = clamp((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
};

/** Gaussian falloff, peaking at 1 when d === 0. */
export const gauss = (d: number, sigma: number) => Math.exp(-(d * d) / (2 * sigma * sigma));

/**
 * Distance between two phases on a unit circle. Used so pulses that straddle
 * the loop point behave the same as pulses in the middle of the cycle.
 */
export const wrapDist = (a: number, b: number) => {
  const d = Math.abs(a - b) % 1;
  return d > 0.5 ? 1 - d : d;
};
