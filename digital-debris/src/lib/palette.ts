import { clamp01 } from "./random";

export type Rgb = readonly [number, number, number];

const hexToRgb = (hex: string): Rgb => {
  const n = parseInt(hex.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

const mix = (a: Rgb, b: Rgb, t: number): Rgb => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];

export interface Palette {
  /** Three-stop element ramp: dim -> mid -> bright. */
  readonly ramp: readonly [Rgb, Rgb, Rgb];
  /** Saturated punctuation colours. */
  readonly accents: readonly Rgb[];
  /** Background radial gradient: centre -> mid -> corner. */
  readonly bgCentre: Rgb;
  readonly bgMid: Rgb;
  readonly bgEdge: Rgb;
  /** Colour of the soft off-frame light shafts. */
  readonly shaft: Rgb;
}

export const TEAL: Palette = {
  ramp: [hexToRgb("#0d4a52"), hexToRgb("#22a8b8"), hexToRgb("#a8f0f8")],
  accents: [hexToRgb("#f07020"), hexToRgb("#e0407a"), hexToRgb("#7ae0a0")],
  bgCentre: hexToRgb("#052228"),
  bgMid: hexToRgb("#03151a"),
  bgEdge: hexToRgb("#01070a"),
  shaft: hexToRgb("#6fd8e8"),
};

export const VIOLET: Palette = {
  ramp: [hexToRgb("#3a1a5a"), hexToRgb("#8a3ce0"), hexToRgb("#e0b8ff")],
  accents: [hexToRgb("#f0a028"), hexToRgb("#30d8e8"), hexToRgb("#ff3c8a")],
  bgCentre: hexToRgb("#0e0420"),
  bgMid: hexToRgb("#080213"),
  bgEdge: hexToRgb("#030008"),
  shaft: hexToRgb("#a878f0"),
};

/** Samples the three-stop element ramp at `t` in [0, 1]. */
export const sampleRamp = (palette: Palette, t: number): Rgb => {
  const c = clamp01(t);
  return c < 0.5
    ? mix(palette.ramp[0], palette.ramp[1], c * 2)
    : mix(palette.ramp[1], palette.ramp[2], (c - 0.5) * 2);
};

export const rgbCss = (c: Rgb) =>
  `rgb(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])})`;

export const rgbaCss = (c: Rgb, a: number) =>
  `rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${a})`;
