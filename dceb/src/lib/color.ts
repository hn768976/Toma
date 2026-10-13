/** "#RRGGBB" -> display sRGB components in 0..1 (no colour management). */
export const hexToSrgb01 = (hex: string): [number, number, number] => {
  const h = hex.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255) as [number, number, number];
};
