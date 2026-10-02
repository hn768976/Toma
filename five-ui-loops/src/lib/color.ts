export const hexToRgb = (hex: string): [number, number, number] => {
  const h = hex.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255) as [number, number, number];
};

const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
export const hexToLinear = (hex: string): [number, number, number] =>
  hexToRgb(hex).map(toLinear) as [number, number, number];

export const rgba = (hex: string, a: number) => {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)},${a})`;
};

export const mixHex = (a: string, b: string, t: number) => {
  const A = hexToRgb(a);
  const B = hexToRgb(b);
  const m = A.map((v, i) => Math.round((v + (B[i] - v) * t) * 255));
  return `rgb(${m[0]},${m[1]},${m[2]})`;
};
