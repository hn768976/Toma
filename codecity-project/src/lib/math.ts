export const TAU = Math.PI * 2;
export const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const smooth = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
// Quintic ease-in-out (zero velocity and acceleration at both ends).
export const easeInOut = (t: number) => {
  t = clamp(t);
  return t * t * t * (t * (t * 6 - 15) + 10);
};
// Closed sway: sum of sines whose periods divide the loop length.
export const loopSin = (frame: number, period: number, cycles: number, phase = 0) =>
  Math.sin((TAU * cycles * frame) / period + phase);
// Position along a periodic schedule: 0..1 within the current slot.
export const slot = (frame: number, period: number, slots: number) => {
  const len = period / slots;
  const f = ((frame % period) + period) % period;
  return { index: Math.floor(f / len), t: (f % len) / len };
};
