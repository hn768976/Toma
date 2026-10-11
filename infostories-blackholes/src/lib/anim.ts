/** Pure frame -> value helpers. Every on-screen value is a function of the frame. */
export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
export const ramp = (f: number, a: number, b: number) => clamp01((f - a) / (b - a));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
export const easeInCubic = (t: number) => t * t * t;
export const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
export const easeOutBack = (t: number) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};
/** Pop-in: 0 -> overshoot -> 1 over `dur` frames from `start`. */
export const pop = (f: number, start: number, dur = 12) =>
  f <= start ? 0 : easeOutBack(ramp(f, start, start + dur));
