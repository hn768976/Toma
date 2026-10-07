// Colours are authored as sRGB hex and converted to linear light for shading, blur and bloom.
// The final post pass converts back to sRGB.

const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));

export type RGB = [number, number, number];

export const hexLinear = (hex: string): RGB => {
  const h = hex.replace("#", "");
  const n = parseInt(h, 16);
  return [toLinear(((n >> 16) & 255) / 255), toLinear(((n >> 8) & 255) / 255), toLinear((n & 255) / 255)];
};
