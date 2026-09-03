// Colour helpers. Every hex string in this project lives in VARIANTS; these
// helpers turn those into canvas-ready `rgba()` strings. Parsing is memoised
// because the draw loops call these tens of thousands of times per frame.

export type Rgb = { r: number; g: number; b: number };

const cache = new Map<string, Rgb>();

export const hexToRgb = (hex: string): Rgb => {
  const hit = cache.get(hex);
  if (hit) return hit;
  const h = hex.replace("#", "");
  const full =
    h.length === 3
      ? h[0] + h[0] + h[1] + h[1] + h[2] + h[2]
      : h;
  const value = parseInt(full, 16);
  const rgb: Rgb = {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  };
  cache.set(hex, rgb);
  return rgb;
};

export const rgba = (hex: string, alpha: number): string => {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

/** Linearly blends two hex colours; t = 0 returns `a`, t = 1 returns `b`. */
export const mix = (a: string, b: string, t: number): Rgb => {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  const k = t < 0 ? 0 : t > 1 ? 1 : t;
  return {
    r: Math.round(ca.r + (cb.r - ca.r) * k),
    g: Math.round(ca.g + (cb.g - ca.g) * k),
    b: Math.round(ca.b + (cb.b - ca.b) * k),
  };
};

export const mixRgba = (a: string, b: string, t: number, alpha: number): string => {
  const c = mix(a, b, t);
  return `rgba(${c.r}, ${c.g}, ${c.b}, ${alpha})`;
};
