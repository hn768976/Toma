/**
 * Palette colours arrive as hex strings from `variants.ts`; these helpers are
 * the only place they get taken apart, so no other module needs a literal.
 */

const parse = (hex: string): [number, number, number] => {
  const v = parseInt(hex.slice(1), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
};

export const withAlpha = (hex: string, alpha: number) => {
  const [r, g, b] = parse(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

/** `amount` > 0 lifts toward white, < 0 sinks toward black. */
export const shade = (hex: string, amount: number, alpha = 1) => {
  const [r, g, b] = parse(hex);
  const mix = (c: number) =>
    Math.round(amount >= 0 ? c + (255 - c) * amount : c * (1 + amount));
  return `rgba(${mix(r)}, ${mix(g)}, ${mix(b)}, ${alpha})`;
};

export const TRANSPARENT = "rgba(0, 0, 0, 0)";
export const black = (alpha: number) => `rgba(0, 0, 0, ${alpha})`;
export const white = (alpha: number) => `rgba(255, 255, 255, ${alpha})`;
