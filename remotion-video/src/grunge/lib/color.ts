/**
 * Colour helpers. Every hex string in this project lives in variants.ts;
 * these turn one into the `rgba()` strings canvas wants.
 */
export type Rgb = { r: number; g: number; b: number };

export const hexToRgb = (hex: string): Rgb => {
  const h = hex.replace("#", "");
  const full =
    h.length === 3
      ? h.charAt(0) + h.charAt(0) + h.charAt(1) + h.charAt(1) + h.charAt(2) + h.charAt(2)
      : h;
  return {
    r: parseInt(full.substring(0, 2), 16),
    g: parseInt(full.substring(2, 4), 16),
    b: parseInt(full.substring(4, 6), 16),
  };
};

/** `rgba(...)` string for a hex colour at the given alpha. */
export const rgba = (hex: string, alpha: number): string => {
  const { r, g, b } = hexToRgb(hex);
  return "rgba(" + r + ", " + g + ", " + b + ", " + Math.max(0, Math.min(1, alpha)) + ")";
};

/** `rgba(...)` string from an already-decoded colour. */
export const rgbaOf = (c: Rgb, alpha: number): string =>
  "rgba(" + c.r + ", " + c.g + ", " + c.b + ", " + Math.max(0, Math.min(1, alpha)) + ")";
