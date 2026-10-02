export type RGB = [number, number, number];

export const hexToRgb = (hex: string): RGB => {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

export const mixRgb = (a: RGB, b: RGB, t: number): RGB => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];

export const rgbStr = (c: RGB, alpha = 1) =>
  alpha >= 1
    ? `rgb(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])})`
    : `rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${alpha.toFixed(3)})`;

/** hex + alpha → rgba() string */
export const withAlpha = (hex: string, alpha: number) => rgbStr(hexToRgb(hex), alpha);

export const mixHex = (a: string, b: string, t: number) => rgbStr(mixRgb(hexToRgb(a), hexToRgb(b), t));
