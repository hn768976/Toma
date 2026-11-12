const parse = (hex: string) => {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const toHex = (rgb: number[]) =>
  '#' + rgb.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');

/** Same hue, `k` darker (0.18 = 18% darker). */
export const darken = (hex: string, k = 0.18) => toHex(parse(hex).map((v) => v * (1 - k)));
/** Same hue, mixed `k` toward white. */
export const lighten = (hex: string, k = 0.35) => toHex(parse(hex).map((v) => v + (255 - v) * k));
