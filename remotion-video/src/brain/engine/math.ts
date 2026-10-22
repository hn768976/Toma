export const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
export const easeInOut = (t: number) => {
  const x = clamp(t);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
};
export const easeInOutSine = (t: number) => -(Math.cos(Math.PI * clamp(t)) - 1) / 2;
export const easeOutCubic = (t: number) => 1 - Math.pow(1 - clamp(t), 3);

// Linear-light RGB from an sRGB hex (shading happens in linear light).
const parse = (hex: string): [number, number, number] => {
  const h = hex.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255) as [number, number, number];
};
const toLinear = (v: number) => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
export const lin = (hex: string): [number, number, number] => {
  const c = parse(hex);
  return [toLinear(c[0]), toLinear(c[1]), toLinear(c[2])];
};
// sRGB (display) RGB in 0..1 — used for backgrounds, which are specified and
// composited in display space so they land on exact code values.
export const srgb = (hex: string): [number, number, number] => parse(hex);

export const TAU = Math.PI * 2;
