import { Color } from 'three';
import { TAU } from './loop';

// Colour cycle for the icon gradient: pairs [A, B], sampled in OKLab.
export const PALETTE_STOPS: [string, string][] = [
  ['#E040FF', '#40E0FF'], // magenta + cyan
  ['#FF3FA0', '#4A7BFF'], // hot pink + blue
  ['#FF3048', '#FF8FB0'], // red + pink
  ['#FFC8D8', '#E040FF'], // soft pink-white + magenta
];

type Vec3 = [number, number, number];

const srgbToLinear = (c: number) =>
  c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);

const hexToLinear = (hex: string): Vec3 => {
  const n = parseInt(hex.slice(1), 16);
  return [
    srgbToLinear(((n >> 16) & 255) / 255),
    srgbToLinear(((n >> 8) & 255) / 255),
    srgbToLinear((n & 255) / 255),
  ];
};

export const linearToOklab = ([r, g, b]: Vec3): Vec3 => {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
};

export const oklabToLinear = ([L, a, b]: Vec3): Vec3 => {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    Math.max(0, 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    Math.max(0, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    Math.max(0, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  ];
};

const LAB_STOPS = PALETTE_STOPS.map(
  ([a, b]) => [linearToOklab(hexToLinear(a)), linearToOklab(hexToLinear(b))] as const,
);

// Smooth cyclic blend: cosine-eased between neighbouring stops, so the cycle
// has no kinks and lands exactly back on stop 0 at t = 1.
const sampleLab = (t: number, which: 0 | 1): Vec3 => {
  const n = LAB_STOPS.length;
  const x = (((t % 1) + 1) % 1) * n;
  const i = Math.floor(x) % n;
  const f = x - Math.floor(x);
  const e = 0.5 - 0.5 * Math.cos(Math.PI * f);
  const p = LAB_STOPS[i][which];
  const q = LAB_STOPS[(i + 1) % n][which];
  return [p[0] + (q[0] - p[0]) * e, p[1] + (q[1] - p[1]) * e, p[2] + (q[2] - p[2]) * e];
};

/** Two linear-RGB gradient colours for loop time t in [0,1). One cycle per loop. */
export const paletteAt = (t: number, outA: Color, outB: Color) => {
  const a = oklabToLinear(sampleLab(t, 0));
  const b = oklabToLinear(sampleLab(t, 1));
  outA.setRGB(a[0], a[1], a[2]);
  outB.setRGB(b[0], b[1], b[2]);
};

export { TAU };
