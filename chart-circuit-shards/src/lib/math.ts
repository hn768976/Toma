export const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
export const easeInOutSine = (t: number) => 0.5 - 0.5 * Math.cos(Math.PI * clamp(t, 0, 1));
export const easeOutCubic = (t: number) => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
export const easeInOutCubic = (t: number) => {
  const x = clamp(t, 0, 1);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
};
export const TAU = Math.PI * 2;
/** Positive modulo. */
export const mod = (x: number, m: number) => ((x % m) + m) % m;

export const hexToRgb = (hex: string): [number, number, number] => {
  const h = hex.replace('#', '');
  const n = parseInt(h, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};
const srgbToLinear1 = (c: number) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
/** sRGB hex -> linear-light RGB triple (what the shaders work in). */
export const hexToLinear = (hex: string): [number, number, number] => {
  const [r, g, b] = hexToRgb(hex);
  return [srgbToLinear1(r), srgbToLinear1(g), srgbToLinear1(b)];
};
