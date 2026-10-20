// Pigment colour helpers. Concentration follows Beer-Lambert: a wash with k
// times the pigment has transmittance T^k, so k > 1 gives a deeper, richer
// accent of the same pigment and k < 1 a paler tint, never a muddy grey.

const toLin = (c: number) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
const toSrgb = (c: number) =>
  c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;

const parse = (hex: string) => {
  const v = parseInt(hex.slice(1), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255].map((x) => x / 255);
};
const format = (rgb: number[]) =>
  `#${rgb
    .map((x) => Math.round(Math.min(1, Math.max(0, x)) * 255).toString(16).padStart(2, "0"))
    .join("")}`;

export const concentrate = (hex: string, k: number) =>
  format(parse(hex).map((c) => toSrgb(Math.pow(Math.max(toLin(c), 1e-4), k))));

/** Two pigments mixed on the palette (multiplicative, like real paint). */
export const mixPigments = (a: string, b: string, t: number) => {
  const pa = parse(a).map(toLin);
  const pb = parse(b).map(toLin);
  return format(pa.map((x, i) => toSrgb(Math.pow(x, 1 - t) * Math.pow(pb[i], t))));
};
