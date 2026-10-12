// Colours are authored as sRGB hex and converted to linear once here, so the
// shaders never depend on three's colour management settings.
export type RGB = [number, number, number];

const toLin = (c: number) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));

export const hexToSrgb = (hex: string): RGB => {
  const h = hex.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255) as RGB;
};
export const lin = (hex: string): RGB => hexToSrgb(hex).map(toLin) as RGB;
