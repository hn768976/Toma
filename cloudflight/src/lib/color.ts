/** Colour helpers (OKLab / OKLCh, sRGB). All deterministic, pure. */
export type RGB = [number, number, number];

export const hexToRgb = (hex: string): RGB => {
  const n = parseInt(hex.replace("#", ""), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};

export const srgbToLinear = (c: number) =>
  c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
export const linearToSrgb = (c: number) =>
  c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;

export const hexToLinear = (hex: string): RGB =>
  hexToRgb(hex).map(srgbToLinear) as RGB;

export const linearToOklab = ([r, g, b]: RGB): RGB => {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
};

export const oklabToLinear = ([L, a, b]: RGB): RGB => {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
};

export type LCh = [number, number, number]; // L, C, h(degrees)

export const linearToOklch = (c: RGB): LCh => {
  const [L, a, b] = linearToOklab(c);
  let h = (Math.atan2(b, a) * 180) / Math.PI;
  if (h < 0) h += 360;
  return [L, Math.hypot(a, b), h];
};

/** OKLCh -> linear sRGB, reducing chroma until the colour is in gamut. */
export const oklchToLinear = ([L, C, h]: LCh): RGB => {
  const hr = (h * Math.PI) / 180;
  let c = C;
  for (let i = 0; i < 24; i++) {
    const rgb = oklabToLinear([L, c * Math.cos(hr), c * Math.sin(hr)]);
    if (rgb.every((v) => v >= -1e-4 && v <= 1.0001)) {
      return rgb.map((v) => Math.min(1, Math.max(0, v))) as RGB;
    }
    c *= 0.94;
  }
  return oklabToLinear([L, 0, 0]).map((v) => Math.min(1, Math.max(0, v))) as RGB;
};

export const mix = (a: number, b: number, t: number) => a + (b - a) * t;
export const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
