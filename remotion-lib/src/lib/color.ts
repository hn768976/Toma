/**
 * Colour helpers. Palettes are supplied as hex strings by the caller; nothing
 * in the drawing code hardcodes a colour.
 */

const cache = new Map<string, [number, number, number]>();

export const hexToRgb = (hex: string): [number, number, number] => {
  const hit = cache.get(hex);
  if (hit) return hit;
  const h = hex.replace("#", "");
  const full =
    h.length === 3
      ? h[0] + h[0] + h[1] + h[1] + h[2] + h[2]
      : h;
  const n = parseInt(full, 16);
  const rgb: [number, number, number] = [
    (n >> 16) & 255,
    (n >> 8) & 255,
    n & 255,
  ];
  cache.set(hex, rgb);
  return rgb;
};

/** `#2E7FD4` + alpha -> `rgba(46,127,212,0.4)` */
export const rgba = (hex: string, alpha: number): string => {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${alpha < 0 ? 0 : alpha > 1 ? 1 : alpha})`;
};

/** Linear blend between two hex colours, returned as an `rgba()` string. */
export const mixRgba = (
  hexA: string,
  hexB: string,
  t: number,
  alpha: number,
): string => {
  const [r1, g1, b1] = hexToRgb(hexA);
  const [r2, g2, b2] = hexToRgb(hexB);
  const k = t < 0 ? 0 : t > 1 ? 1 : t;
  return `rgba(${Math.round(r1 + (r2 - r1) * k)},${Math.round(
    g1 + (g2 - g1) * k,
  )},${Math.round(b1 + (b2 - b1) * k)},${alpha < 0 ? 0 : alpha > 1 ? 1 : alpha})`;
};
