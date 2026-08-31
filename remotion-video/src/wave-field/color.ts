/**
 * Colour utilities. Every colour value passed in here originates in the
 * VARIANTS palette; nothing in this file introduces a colour of its own.
 */

const cache = new Map<string, string>();

const parse = (hex: string): [number, number, number] => {
  const value = parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
};

/** `rgba()` string for a palette hex at the given alpha. */
export const withAlpha = (hex: string, alpha: number): string => {
  const key = `${hex}|${alpha.toFixed(4)}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const [r, g, b] = parse(hex);
  const out = `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, alpha)).toFixed(4)})`;
  cache.set(key, out);
  return out;
};

/** A palette hex scaled toward black, kept opaque. Used for gradient stops. */
export const shade = (hex: string, factor: number): string => {
  const key = `${hex}|shade|${factor.toFixed(4)}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const [r, g, b] = parse(hex);
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v * factor)));
  const out = `rgb(${clamp(r)}, ${clamp(g)}, ${clamp(b)})`;
  cache.set(key, out);
  return out;
};
