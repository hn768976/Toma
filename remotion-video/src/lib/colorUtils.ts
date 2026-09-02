// Vendored from remotion-lib (~/projects/remotion-lib/src).
// Do not edit here: change it in the library and re-run
// `node scripts/sync-lib.mjs`. Copied in so this project renders standalone.
/**
 * Colour helpers. These exist so that no file other than ./variants needs to
 * contain a hex literal: every tint used in the piece (fibre edge, grain,
 * vignette, light gradient) is derived from a palette entry.
 */

export type Rgb = { r: number; g: number; b: number };

export const hexToRgb = (hex: string): Rgb => {
  const h = hex.charAt(0) === "#" ? hex.slice(1) : hex;
  const full =
    h.length === 3
      ? h.charAt(0) + h.charAt(0) + h.charAt(1) + h.charAt(1) + h.charAt(2) + h.charAt(2)
      : h;
  const n = parseInt(full, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
};

export const rgba = (hex: string, alpha: number): string => {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

/** Linear blend between two hex colours; t = 0 gives a, t = 1 gives b. */
export const mix = (a: string, b: string, t: number): Rgb => {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  return {
    r: Math.round(ca.r + (cb.r - ca.r) * t),
    g: Math.round(ca.g + (cb.g - ca.g) * t),
    b: Math.round(ca.b + (cb.b - ca.b) * t),
  };
};

export const mixCss = (a: string, b: string, t: number, alpha = 1): string => {
  const c = mix(a, b, t);
  return `rgba(${c.r}, ${c.g}, ${c.b}, ${alpha})`;
};

/** Move a colour toward white (amount > 0) or black (amount < 0). */
export const shade = (hex: string, amount: number, alpha = 1): string => {
  const { r, g, b } = hexToRgb(hex);
  const target = amount >= 0 ? 255 : 0;
  const t = Math.abs(amount);
  const f = (v: number) => Math.round(v + (target - v) * t);
  return `rgba(${f(r)}, ${f(g)}, ${f(b)}, ${alpha})`;
};

/** Shift a colour's hue-free warmth/coolness slightly, for paper variety. */
export const tint = (hex: string, warm: number, lightness: number): string => {
  const { r, g, b } = hexToRgb(hex);
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return `rgb(${clamp(r + warm * 10 + lightness * 255)}, ${clamp(
    g + lightness * 255,
  )}, ${clamp(b - warm * 10 + lightness * 255)})`;
};
