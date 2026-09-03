// Vendored from @studio/remotion-lib (src/color.ts). Do not edit here —
// edit the library and re-run `node scripts/sync-lib.mjs`.
/**
 * Colour utilities. Takes the `#RRGGBB` strings that live in VARIANTS and
 * gives them an alpha channel; no colour is ever written down here.
 */

export const rgbOf = (hex: string): [number, number, number] => {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

export const withAlpha = (hex: string, alpha: number): string => {
  const [r, g, b] = rgbOf(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

/** Mixes two hex colours; `t` of 0 returns `a`, 1 returns `b`. */
export const mix = (a: string, b: string, t: number): string => {
  const [r1, g1, b1] = rgbOf(a);
  const [r2, g2, b2] = rgbOf(b);
  const l = (x: number, y: number) => Math.round(x + (y - x) * t);
  return `rgb(${l(r1, r2)}, ${l(g1, g2)}, ${l(b1, b2)})`;
};
