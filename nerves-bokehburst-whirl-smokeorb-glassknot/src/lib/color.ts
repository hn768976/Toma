/** sRGB hex -> [r,g,b] in 0..1 (sRGB, not linearised). */
export const hexToRgb = (hex: string): [number, number, number] => {
  const h = hex.replace("#", "");
  const n = parseInt(h, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};

const toLin = (c: number) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));

/** sRGB hex -> linear-light [r,g,b]. */
export const hexToLinear = (hex: string): [number, number, number] => {
  const [r, g, b] = hexToRgb(hex);
  return [toLin(r), toLin(g), toLin(b)];
};

export const hexToNumber = (hex: string) => parseInt(hex.replace("#", ""), 16);
