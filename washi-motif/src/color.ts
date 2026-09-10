/**
 * Colour helpers. Every colour in the project originates in PALETTES; these
 * functions only shade, mix and alpha-compose those values, so no hex literal
 * is ever needed outside the palette table.
 */

export type Rgb = { r: number; g: number; b: number };

const WHITE: Rgb = { r: 255, g: 255, b: 255 };
const BLACK: Rgb = { r: 0, g: 0, b: 0 };

export const parseHex = (hex: string): Rgb => {
  const raw = hex.replace("#", "");
  const full =
    raw.length === 3
      ? raw
          .split("")
          .map((c) => c + c)
          .join("")
      : raw;
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  };
};

export const mix = (a: Rgb, b: Rgb, t: number): Rgb => ({
  r: Math.round(a.r + (b.r - a.r) * t),
  g: Math.round(a.g + (b.g - a.g) * t),
  b: Math.round(a.b + (b.b - a.b) * t),
});

export const lighten = (c: Rgb, t: number): Rgb => mix(c, WHITE, t);
export const darken = (c: Rgb, t: number): Rgb => mix(c, BLACK, t);

export const css = (c: Rgb, alpha = 1): string =>
  alpha >= 1
    ? `rgb(${c.r}, ${c.g}, ${c.b})`
    : `rgba(${c.r}, ${c.g}, ${c.b}, ${alpha})`;

/** Perceived lightness, 0..1. Used to decide which way to shade. */
export const luminance = (c: Rgb): number =>
  (0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b) / 255;

/**
 * Shade away from a colour in whichever direction is visible against it:
 * lighter on dark paper, darker on light paper.
 */
export const contrastShade = (c: Rgb, t: number): Rgb =>
  luminance(c) < 0.5 ? lighten(c, t) : darken(c, t);
