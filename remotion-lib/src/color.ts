/**
 * Colour maths for canvas work. Every function takes its colours as
 * arguments — nothing here knows or assumes a palette.
 *
 * @module color
 */

const parse = (hex: string) => ({
  r: parseInt(hex.slice(1, 3), 16),
  g: parseInt(hex.slice(3, 5), 16),
  b: parseInt(hex.slice(5, 7), 16),
});

/**
 * `#rrggbb` plus an alpha, as a canvas-ready `rgba()` string.
 * Short (`#rgb`) form is not supported.
 */
export const withAlpha = (hex: string, alpha: number) => {
  const { r, g, b } = parse(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

/** Linear mix of two `#rrggbb` colours. `t` = 0 gives `a`, 1 gives `b`. */
export const mixHex = (a: string, b: string, t: number) => {
  const ca = parse(a);
  const cb = parse(b);
  const m = (x: number, y: number) => Math.round(x + (y - x) * t);
  return `rgb(${m(ca.r, cb.r)}, ${m(ca.g, cb.g)}, ${m(ca.b, cb.b)})`;
};
