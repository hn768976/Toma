/**
 * Tiny hex-colour helpers for canvas painting.
 *
 * Palette-agnostic and dependency-free: every function takes colours in and
 * gives strings out, so a piece can drive them from whatever palette object
 * it likes.
 */

export type Rgb = { r: number; g: number; b: number };

/** Parses `#rgb` or `#rrggbb` into 0-255 channels. */
export const hexToRgb = (hex: string): Rgb => {
  const h = hex.replace("#", "");
  const full =
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h;
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  };
};

/** `rgba(...)` string for a hex colour at a given alpha. */
export const rgba = (hex: string, alpha: number): string => {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

/**
 * Linear blend between two hex colours. `t = 0` gives `a`, `t = 1` gives `b`.
 * Used to derive the in-between bands of a gradient from a palette that only
 * names its extremes.
 */
export const mix = (a: string, b: string, t: number): string => {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  const k = Math.max(0, Math.min(1, t));
  const ch = (x: number, y: number) => Math.round(x + (y - x) * k);
  return `rgb(${ch(ca.r, cb.r)}, ${ch(ca.g, cb.g)}, ${ch(ca.b, cb.b)})`;
};

/** Like {@link mix} but returns `#rrggbb`, so the result can be mixed again. */
export const mixHex = (a: string, b: string, t: number): string => {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  const k = Math.max(0, Math.min(1, t));
  const ch = (x: number, y: number) =>
    Math.round(x + (y - x) * k)
      .toString(16)
      .padStart(2, "0");
  return `#${ch(ca.r, cb.r)}${ch(ca.g, cb.g)}${ch(ca.b, cb.b)}`;
};

/** Scales a hex colour toward black. `t = 0` is unchanged, `t = 1` is black. */
export const darken = (hex: string, t: number): string => {
  const { r, g, b } = hexToRgb(hex);
  const k = 1 - Math.max(0, Math.min(1, t));
  return `rgb(${Math.round(r * k)}, ${Math.round(g * k)}, ${Math.round(b * k)})`;
};

/** Scales a hex colour toward white. `t = 0` is unchanged, `t = 1` is white. */
export const lighten = (hex: string, t: number): string => {
  const { r, g, b } = hexToRgb(hex);
  const k = Math.max(0, Math.min(1, t));
  const ch = (x: number) => Math.round(x + (255 - x) * k);
  return `rgb(${ch(r)}, ${ch(g)}, ${ch(b)})`;
};
