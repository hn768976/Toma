/** Deterministic, frame-accurate easing + a seeded PRNG (no Math.random at render time). */

export const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));

/** Normalised 0..1 progress across [start, end] frames. */
export const span = (frame: number, start: number, end: number) =>
  clamp((frame - start) / Math.max(1, end - start));

export const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
export const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
export const easeOutQuint = (t: number) => 1 - Math.pow(1 - t, 5);

/**
 * Critically-damped "settle": rises past the target and eases back.
 * Used for the podium risers so they land with weight rather than stopping dead.
 */
export const easeOutBack = (t: number, overshoot = 1.05) => {
  const c3 = overshoot + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + overshoot * Math.pow(t - 1, 2);
};

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** mulberry32 - small, fast, fully deterministic. */
export const makeRandom = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};
