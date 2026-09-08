/**
 * Easing and timing helpers.
 *
 * Everything here is a pure function of the frame number — no clocks, no
 * delta accumulation — because Remotion renders frames out of order across
 * threads.
 */

export const clamp = (v: number, min = 0, max = 1) =>
  v < min ? min : v > max ? max : v;

/** Normalised 0..1 progress of a window that starts at `start` and lasts `duration`. */
export const progress = (frame: number, start: number, duration: number) =>
  clamp((frame - start) / Math.max(duration, 1e-6));

export const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
export const easeOutQuint = (t: number) => 1 - Math.pow(1 - t, 5);
export const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

/** Mechanical assembly snap: overshoots slightly, then settles. */
export const easeOutBack = (t: number, overshoot = 1.32) => {
  const c3 = overshoot + 1;
  const p = t - 1;
  return 1 + c3 * p * p * p + overshoot * p * p;
};

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export const smoothstep = (edge0: number, edge1: number, x: number) => {
  const t = clamp((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
};
