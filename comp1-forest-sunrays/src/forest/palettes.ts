// Palettes are authored in sRGB (what you see in a colour picker) and
// converted to linear light for the shader.

export type Rgb = [number, number, number];

const srgbToLinear = (c: number) => {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
};
export const lin = (r: number, g: number, b: number): Rgb => [
  srgbToLinear(r),
  srgbToLinear(g),
  srgbToLinear(b),
];

export type ForestPalette = {
  name: string;
  bgTop: Rgb;
  bgLow: Rgb;
  bgSide: Rgb;
  foliage: Rgb;
  foliage2: Rgb;
  lift: Rgb;
  /** additive light colours (already linear, may exceed sRGB gamut) */
  haze: Rgb;
  rayCol: Rgb;
  sunCol: Rgb;
  /** bokeh disc colours, additive linear */
  discBright: Rgb;
  discCool: Rgb;
  discGreen: Rgb;
  discWarm: Rgb;
  saturation: number;
};

/** Version 1 — matched to the reference: cool teal/cyan morning forest. */
export const REFERENCE_PALETTE: ForestPalette = {
  name: "reference-teal",
  bgTop: lin(80, 110, 122),
  bgLow: lin(40, 78, 80),
  bgSide: lin(36, 82, 66),
  foliage: lin(78, 156, 104),
  foliage2: lin(92, 118, 62),
  lift: [0, 0, 0],
  haze: [0.23, 0.25, 0.27],
  rayCol: [0.3, 0.32, 0.4],
  sunCol: [0.95, 0.93, 0.72],
  discBright: [0.6, 0.67, 0.7],
  discCool: [0.36, 0.46, 0.56],
  discGreen: [0.3, 0.45, 0.3],
  discWarm: [0.6, 0.62, 0.42],
  saturation: 1.0,
};

/**
 * Version 2 — alternative colour palette: late golden-hour sun. Same forest,
 * same light behaviour, but warm amber foliage, honey bokeh and golden rays.
 */
export const GOLDEN_HOUR_PALETTE: ForestPalette = {
  name: "golden-hour",
  bgTop: lin(150, 108, 58),
  bgLow: lin(52, 34, 16),
  bgSide: lin(84, 54, 20),
  foliage: lin(128, 104, 28),
  foliage2: lin(150, 66, 18),
  lift: [0.004, 0.002, 0.0],
  haze: [0.34, 0.2, 0.075],
  rayCol: [0.46, 0.3, 0.11],
  sunCol: [1.0, 0.72, 0.36],
  discBright: [0.78, 0.55, 0.26],
  discCool: [0.5, 0.33, 0.15],
  discGreen: [0.38, 0.34, 0.08],
  discWarm: [0.75, 0.38, 0.12],
  saturation: 1.05,
};
