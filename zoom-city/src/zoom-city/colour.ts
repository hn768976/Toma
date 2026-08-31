/**
 * Colours arrive from VARIANTS as hex strings; the canvas wants rgba(). These
 * helpers do that conversion and nothing else — no colour is invented here.
 */

export type RGB = readonly [number, number, number];

const cache = new Map<string, RGB>();

export const hexToRgb = (hex: string): RGB => {
  const hit = cache.get(hex);
  if (hit) {
    return hit;
  }
  const n = parseInt(hex.slice(1), 16);
  const rgb: RGB = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  cache.set(hex, rgb);
  return rgb;
};

export const rgba = (c: RGB, alpha: number) =>
  `rgba(${c[0]},${c[1]},${c[2]},${alpha.toFixed(4)})`;

/** Mix towards `b` by `t`. Used to push the hottest streaks towards white. */
export const mix = (a: RGB, b: RGB, t: number): RGB => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];

/** Plain black / white are not palette colours, they are canvas primitives. */
export const shadow = (alpha: number) => `rgba(0,0,0,${alpha.toFixed(4)})`;
