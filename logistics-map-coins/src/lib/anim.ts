export const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const smoothstep = (a: number, b: number, v: number) => {
  const t = clamp((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};
export const easeInOut = (t: number) => {
  const c = clamp(t);
  return c < 0.5 ? 4 * c * c * c : 1 - Math.pow(-2 * c + 2, 3) / 2;
};
export const easeOutCubic = (t: number) => 1 - Math.pow(1 - clamp(t), 3);
export const easeInQuad = (t: number) => clamp(t) * clamp(t);
export const TAU = Math.PI * 2;
// Phase in [0,1) of a periodic motion. Periods used for loops must divide the
// loop length (600 frames) so frame 600 == frame 0.
export const phase = (frame: number, period: number, offset = 0) => {
  const p = (frame + offset) / period;
  return p - Math.floor(p);
};
