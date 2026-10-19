export const hexToRgb = (hex: string): [number, number, number] => {
  const h = hex.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255) as [number, number, number];
};
const toLin = (c: number) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
export const hexToLinear = (hex: string): [number, number, number] =>
  hexToRgb(hex).map(toLin) as [number, number, number];
// Optical density of a pigment whose full-strength glaze over white paper
// gives `hex` (Beer-Lambert: paper * exp(-od * amount)).
export const hexToOD = (hex: string): [number, number, number] =>
  hexToLinear(hex).map((c) => -Math.log(Math.max(c, 0.002))) as [number, number, number];
