import type { ColorKey, Palette } from "../palettes";

const parse = (hex: string): [number, number, number] => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

/** Resolve a palette slot to a css rgba() string at the given alpha. */
export const rgba = (palette: Palette, key: ColorKey, alpha = 1): string => {
  const [r, g, b] = parse(palette[key]);
  return `rgba(${r},${g},${b},${alpha})`;
};

/** Same, but scaled toward black first — for the dim end of a text field. */
export const shade = (
  palette: Palette,
  key: ColorKey,
  amount: number,
  alpha = 1,
): string => {
  const [r, g, b] = parse(palette[key]);
  const k = Math.max(0, amount);
  return `rgba(${Math.round(r * k)},${Math.round(g * k)},${Math.round(b * k)},${alpha})`;
};

/** Black, for vignettes and knock-outs. Deliberately not a hex literal. */
export const ink = (alpha: number): string => `rgba(0,0,0,${alpha})`;

/** Palette colour with per-channel multipliers — for flare temperature. */
export const tintRgba = (
  palette: Palette,
  key: ColorKey,
  mul: [number, number, number],
  alpha = 1,
): string => {
  const [r, g, b] = parse(palette[key]);
  const c = (v: number, m: number) => Math.round(Math.min(255, v * m));
  return `rgba(${c(r, mul[0])},${c(g, mul[1])},${c(b, mul[2])},${alpha})`;
};
