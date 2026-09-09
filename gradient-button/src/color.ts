/**
 * Colour helpers.
 *
 * Gradient stops are interpolated through Oklab rather than sRGB: a straight
 * sRGB lerp between, say, magenta and blue dips through a desaturated purple
 * that reads as a dark notch on the border. Oklab keeps the ramp even.
 */

export type RGB = [number, number, number];

export const hexToRgb = (hex: string): RGB => {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16) / 255,
    parseInt(h.slice(2, 4), 16) / 255,
    parseInt(h.slice(4, 6), 16) / 255,
  ];
};

const srgbToLinear = (c: number) =>
  c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;

const linearToSrgb = (c: number) =>
  c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055;

const rgbToOklab = ([r, g, b]: RGB): RGB => {
  const lr = srgbToLinear(r);
  const lg = srgbToLinear(g);
  const lb = srgbToLinear(b);
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
};

const oklabToRgb = ([L, a, bb]: RGB): RGB => {
  const l = (L + 0.3963377774 * a + 0.2158037573 * bb) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * bb) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * bb) ** 3;
  return [
    linearToSrgb(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    linearToSrgb(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    linearToSrgb(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  ];
};

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

export type Stop = { at: number; hex: string };

/**
 * Builds a cyclic gradient sampler over t in [0, 1). Stops are given as
 * fractions of the perimeter; the last stop wraps around to the first.
 */
export const makeRamp = (stops: Stop[]) => {
  const lab = stops.map((s) => ({ at: s.at, lab: rgbToOklab(hexToRgb(s.hex)) }));

  return (t: number): RGB => {
    const u = ((t % 1) + 1) % 1;
    let i = 0;
    while (i < lab.length - 1 && lab[i + 1].at <= u) {
      i += 1;
    }
    const a = lab[i];
    const b = lab[(i + 1) % lab.length];
    const span = (b.at > a.at ? b.at : b.at + 1) - a.at;
    const k = span === 0 ? 0 : (u - a.at) / span;
    return oklabToRgb([
      a.lab[0] + (b.lab[0] - a.lab[0]) * k,
      a.lab[1] + (b.lab[1] - a.lab[1]) * k,
      a.lab[2] + (b.lab[2] - a.lab[2]) * k,
    ]);
  };
};

/**
 * Grades one gradient colour for its place under the travelling highlight.
 *
 * `sat` pulls the hue toward neutral and `level` fades it toward `dim` — the
 * colour the border settles to where no light is falling on it (black on the
 * dark themes, a pale grey on the light one). Doing it this way, rather than
 * simply scaling brightness, is what keeps the unlit stretch reading as
 * *unlit* instead of as a hard outline on a light background.
 */
export const grade = (rgb: RGB, sat: number, level: number, dim: RGB): string => {
  const grey = 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
  const out = rgb.map((c, i) => {
    const desat = grey + (c - grey) * sat;
    return clamp01(dim[i] + (desat - dim[i]) * level);
  });
  return `rgb(${out.map((c) => Math.round(c * 255)).join(",")})`;
};

export const toCss = (rgb: RGB): string =>
  `rgb(${rgb.map((c) => Math.round(clamp01(c) * 255)).join(",")})`;
