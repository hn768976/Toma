export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const range = (x: number, a: number, b: number) => clamp01((x - a) / (b - a));
export const smooth = (x: number) => x * x * (3 - 2 * x);
export const easeOutCubic = (x: number) => 1 - Math.pow(1 - clamp01(x), 3);
export const easeInOutCubic = (x: number) => {
  const t = clamp01(x);
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
};
export const easeOutBack = (x: number, s = 1.7) => {
  const t = clamp01(x) - 1;
  return 1 + (s + 1) * t * t * t + s * t * t;
};
export const TAU = Math.PI * 2;
// Periodic helpers for loops: whole cycles over `period` frames.
export const cyc = (frame: number, period: number, cycles = 1, phase = 0) =>
  Math.sin(TAU * ((frame / period) * cycles + phase));
