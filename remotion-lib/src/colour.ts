/**
 * Colour parsing and mixing for canvas work.
 *
 * Palette-agnostic: nothing here holds a colour of its own. Callers pass hex
 * strings from their own palette and get back values they can hand to a
 * canvas fillStyle.
 *
 * @example
 *   const body = mixHex("#2E7FD4", "#7FC4F5", 0.22);
 *   ctx.fillStyle = rgba(body, 0.4);
 */
export type Rgb = { r: number; g: number; b: number };

const cache = new Map<string, Rgb>();

/** Parse "#RRGGBB" into components. Results are memoised. */
export const parseHex = (hex: string): Rgb => {
  const hit = cache.get(hex);
  if (hit) return hit;
  const h = hex.replace("#", "");
  const rgb: Rgb = {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
  cache.set(hex, rgb);
  return rgb;
};

/** Linear blend between two parsed colours. */
export const mixRgb = (a: Rgb, b: Rgb, t: number): Rgb => ({
  r: a.r + (b.r - a.r) * t,
  g: a.g + (b.g - a.g) * t,
  b: a.b + (b.b - a.b) * t,
});

/** A canvas-ready "rgba(...)" string. */
export const rgba = (c: Rgb, alpha: number): string =>
  `rgba(${Math.round(c.r)},${Math.round(c.g)},${Math.round(c.b)},${alpha.toFixed(4)})`;

/** Linear blend between two hex colours. */
export const mixHex = (a: string, b: string, t: number): Rgb =>
  mixRgb(parseHex(a), parseHex(b), t);

export const clamp = (v: number, lo: number, hi: number) =>
  v < lo ? lo : v > hi ? hi : v;

export const TAU = Math.PI * 2;
