/**
 * Colour helpers. Deliberately contains no colour literals of its own —
 * every hex in this project lives in VARIANTS (src/variants.ts).
 */

const cache = new Map<string, [number, number, number]>();

const parse = (hex: string): [number, number, number] => {
  const hit = cache.get(hex);
  if (hit) {
    return hit;
  }
  const raw = hex.replace("#", "");
  const full =
    raw.length === 3
      ? raw
          .split("")
          .map((c) => c + c)
          .join("")
      : raw;
  const num = parseInt(full, 16);
  const rgb: [number, number, number] = [
    (num >> 16) & 255,
    (num >> 8) & 255,
    num & 255,
  ];
  cache.set(hex, rgb);
  return rgb;
};

/** `#2E7FD4` + 0.4 -> `rgba(46,127,212,0.4)` */
export const alpha = (hex: string, a: number): string => {
  const [r, g, b] = parse(hex);
  return `rgba(${r},${g},${b},${a})`;
};

/** Blend two hex colours in sRGB. Returns an `rgb()` string. */
export const mix = (from: string, to: string, t: number): string => {
  const [r1, g1, b1] = parse(from);
  const [r2, g2, b2] = parse(to);
  const l = (a: number, b: number) => Math.round(a + (b - a) * t);
  return `rgb(${l(r1, r2)},${l(g1, g2)},${l(b1, b2)})`;
};
