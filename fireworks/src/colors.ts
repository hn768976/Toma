/**
 * Colour helpers. No colour literals live here — every colour comes in from a
 * variant palette as a hex string and is only ever taken apart or mixed.
 */

export type Rgb = readonly [number, number, number];

const cache = new Map<string, Rgb>();

export const hexToRgb = (hex: string): Rgb => {
  const cached = cache.get(hex);
  if (cached) {
    return cached;
  }
  const raw = hex.replace('#', '');
  const full =
    raw.length === 3
      ? raw
          .split('')
          .map((c) => c + c)
          .join('')
      : raw;
  const n = parseInt(full, 16);
  const rgb: Rgb = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  cache.set(hex, rgb);
  return rgb;
};

export const mixRgb = (a: Rgb, b: Rgb, t: number): Rgb => [
  Math.round(a[0] + (b[0] - a[0]) * t),
  Math.round(a[1] + (b[1] - a[1]) * t),
  Math.round(a[2] + (b[2] - a[2]) * t),
];

export const rgbCss = (c: Rgb): string => `rgb(${c[0]},${c[1]},${c[2]})`;

export const rgbaCss = (c: Rgb, alpha: number): string =>
  `rgba(${c[0]},${c[1]},${c[2]},${alpha})`;

export const hexToRgbaCss = (hex: string, alpha: number): string =>
  rgbaCss(hexToRgb(hex), alpha);
