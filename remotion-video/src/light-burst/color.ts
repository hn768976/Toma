// Minimal color helpers. Palettes are authored as hex strings (easy to eyedrop
// against the reference) and converted to rgba() once, at module/memo level.

export type Rgb = { r: number; g: number; b: number };

export const hexToRgb = (hex: string): Rgb => {
  const h = hex.replace("#", "");
  const full =
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h;
  const n = parseInt(full, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
};

export const rgba = (c: Rgb, alpha: number) =>
  `rgba(${c.r}, ${c.g}, ${c.b}, ${alpha})`;

export const mixRgb = (a: Rgb, b: Rgb, t: number): Rgb => ({
  r: Math.round(a.r + (b.r - a.r) * t),
  g: Math.round(a.g + (b.g - a.g) * t),
  b: Math.round(a.b + (b.b - a.b) * t),
});

export const clamp = (v: number, min = 0, max = 1) =>
  v < min ? min : v > max ? max : v;
