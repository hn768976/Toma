/** Small colour helpers. All palette colours come from variants.ts. */

const cache = new Map<string, [number, number, number]>();

export const hexToRgb = (hex: string): [number, number, number] => {
  const hit = cache.get(hex);
  if (hit) {
    return hit;
  }
  const n = parseInt(hex.slice(1), 16);
  const rgb: [number, number, number] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  cache.set(hex, rgb);
  return rgb;
};

export const rgba = (hex: string, alpha: number): string => {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${alpha})`;
};

/** Linear mix of two palette colours, returned as an rgba() string. */
export const mix = (hexA: string, hexB: string, t: number, alpha: number): string => {
  const a = hexToRgb(hexA);
  const b = hexToRgb(hexB);
  const r = Math.round(a[0] + (b[0] - a[0]) * t);
  const g = Math.round(a[1] + (b[1] - a[1]) * t);
  const bl = Math.round(a[2] + (b[2] - a[2]) * t);
  return `rgba(${r},${g},${bl},${alpha})`;
};
