/** Small, dependency-free easing/interpolation helpers used by the timelines. */

export const clamp = (v: number, min = 0, max = 1) => Math.min(max, Math.max(min, v));

/** Linear remap of `v` from [inA, inB] to [outA, outB], clamped to the output range. */
export const remap = (v: number, inA: number, inB: number, outA: number, outB: number) => {
  if (inB === inA) return outA;
  return outA + clamp((v - inA) / (inB - inA)) * (outB - outA);
};

/** Hermite smoothstep between two edges. */
export const smoothstep = (edge0: number, edge1: number, v: number) => {
  const t = clamp((v - edge0) / (edge1 - edge0 || 1e-6));
  return t * t * (3 - 2 * t);
};

/** Quintic smootherstep — zero 1st and 2nd derivative at both ends. */
export const smootherstep = (edge0: number, edge1: number, v: number) => {
  const t = clamp((v - edge0) / (edge1 - edge0 || 1e-6));
  return t * t * t * (t * (t * 6 - 15) + 10);
};

export const easeOutCubic = (t: number) => 1 - Math.pow(1 - clamp(t), 3);
export const easeInCubic = (t: number) => Math.pow(clamp(t), 3);
export const easeOutQuint = (t: number) => 1 - Math.pow(1 - clamp(t), 5);
export const easeInQuad = (t: number) => clamp(t) * clamp(t);

export const easeInOutCubic = (t: number) => {
  const c = clamp(t);
  return c < 0.5 ? 4 * c * c * c : 1 - Math.pow(-2 * c + 2, 3) / 2;
};

/** Overshoots past 1 then settles — used for the chip seating "snap". */
export const easeOutBack = (t: number, overshoot = 1.4) => {
  const c = clamp(t);
  const c3 = overshoot + 1;
  return 1 + c3 * Math.pow(c - 1, 3) + overshoot * Math.pow(c - 1, 2);
};

/** Decaying oscillation, starts at 0, settles at 1. */
export const springSettle = (t: number, frequency = 9, damping = 7) => {
  const c = clamp(t);
  if (c >= 1) return 1;
  return 1 - Math.cos(c * frequency) * Math.exp(-c * damping);
};

/** A quick spike: 0 -> 1 -> 0 across [start, end], peaking `peakAt` through it. */
export const pulse = (v: number, start: number, end: number, peakAt = 0.25) => {
  if (v <= start || v >= end) return 0;
  const t = (v - start) / (end - start);
  return t < peakAt
    ? smoothstep(0, 1, t / peakAt)
    : 1 - smoothstep(0, 1, (t - peakAt) / (1 - peakAt));
};

/** Sharp attack, exponential decay — flashes and impacts. */
export const flash = (v: number, at: number, attack: number, decay: number) => {
  if (v < at) return 0;
  if (v < at + attack) return smoothstep(0, 1, (v - at) / attack);
  return Math.exp(-(v - at - attack) / decay);
};

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/**
 * Deterministic smooth noise in 1D — value noise with cubic interpolation.
 * Used for gentle handheld camera drift.
 */
export const noise1 = (x: number, seed = 0) => {
  const hash = (n: number) => {
    const s = Math.sin(n * 127.1 + seed * 311.7) * 43758.5453123;
    return s - Math.floor(s);
  };
  const i = Math.floor(x);
  const f = x - i;
  const u = f * f * (3 - 2 * f);
  return lerp(hash(i), hash(i + 1), u) * 2 - 1;
};
