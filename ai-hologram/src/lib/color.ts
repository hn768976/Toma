export type Rgb = { r: number; g: number; b: number };

/** #rrggbb -> 0..1 linear-ish sRGB triple (three.js Color handles the rest). */
export const hexToRgb = (hex: string): Rgb => {
  const n = parseInt(hex.replace("#", ""), 16);
  return {
    r: ((n >> 16) & 255) / 255,
    g: ((n >> 8) & 255) / 255,
    b: (n & 255) / 255,
  };
};
