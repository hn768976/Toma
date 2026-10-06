export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
export const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
export const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
export const easeOutBack = (t: number, s = 1.4) =>
  1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2);
export const easeInOutSine = (t: number) => -(Math.cos(Math.PI * t) - 1) / 2;
/** Progress of `x` through [a, b], clamped. */
export const prog = (x: number, a: number, b: number) => clamp01((x - a) / (b - a));
export const TAU = Math.PI * 2;
