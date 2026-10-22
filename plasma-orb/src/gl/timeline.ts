export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
export const smooth = (e0: number, e1: number, x: number) => {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
// Smooth bump that rises over [a,b], holds until c and falls by d.
export const envelope = (x: number, a: number, b: number, c: number, d: number) =>
  smooth(a, b, x) * (1 - smooth(c, d, x));
