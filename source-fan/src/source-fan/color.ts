/**
 * Tiny colour helpers. Every colour used by the piece comes out of the
 * VARIANTS palette as a hex string; this module only parses and mixes.
 */

export type Rgb = readonly [number, number, number];

const parseCache = new Map<string, Rgb>();

export const hexToRgb = (hex: string): Rgb => {
  const cached = parseCache.get(hex);
  if (cached) {
    return cached;
  }
  const clean = hex.replace("#", "");
  const value = parseInt(clean, 16);
  const rgb: Rgb = [(value >> 16) & 255, (value >> 8) & 255, value & 255];
  parseCache.set(hex, rgb);
  return rgb;
};

export const mixRgb = (a: Rgb, b: Rgb, t: number): Rgb => {
  const k = t < 0 ? 0 : t > 1 ? 1 : t;
  return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
};

export const rgba = (c: Rgb, alpha: number): string =>
  `rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${alpha.toFixed(4)})`;

export const scaleRgb = (c: Rgb, k: number): Rgb => [
  Math.min(255, c[0] * k),
  Math.min(255, c[1] * k),
  Math.min(255, c[2] * k),
];
