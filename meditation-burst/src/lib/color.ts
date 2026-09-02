/** Small colour helpers so palettes can stay as plain hex strings. */

export type Rgb = { r: number; g: number; b: number };

const HEX = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i;

export const hexToRgb = (hex: string): Rgb => {
  const m = HEX.exec(hex.trim());
  if (!m) {
    throw new Error(`hexToRgb: not a 6-digit hex colour: ${hex}`);
  }
  return {
    r: parseInt(m[1], 16),
    g: parseInt(m[2], 16),
    b: parseInt(m[3], 16),
  };
};

/** `#RRGGBB` + alpha -> a canvas-ready `rgba()` string. */
export const withAlpha = (hex: string, alpha: number): string => {
  const { r, g, b } = hexToRgb(hex);
  const a = alpha < 0 ? 0 : alpha > 1 ? 1 : alpha;
  return `rgba(${r}, ${g}, ${b}, ${a.toFixed(4)})`;
};

/** Linear blend between two hex colours; `t = 0` returns `a`. */
export const mixHex = (a: string, b: string, t: number): string => {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  const k = t < 0 ? 0 : t > 1 ? 1 : t;
  const to = (n: number) => Math.round(n).toString(16).padStart(2, "0");
  return `#${to(ca.r + (cb.r - ca.r) * k)}${to(ca.g + (cb.g - ca.g) * k)}${to(
    ca.b + (cb.b - ca.b) * k,
  )}`;
};
