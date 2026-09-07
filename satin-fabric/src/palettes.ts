export type SatinPalette = {
  /** Composition id. Remotion ids may not contain underscores. */
  id: string;
  /** Delivery filename stem. */
  out: string;
  label: string;

  /** Deepest troughs, base tone and brightest highlight, as sRGB hex. */
  trough: string;
  base: string;
  high: string;

  /** Key light from the upper left, at a low grazing angle. */
  keyDir: [number, number, number];
  keyInt: number;
  /** Dim cool fill from the opposite side, so troughs stay blue-black. */
  fillDir: [number, number, number];
  fillInt: number;
  fillTint: [number, number, number];
  fillTintMix: number;

  ambient: number;
  diffuse: number;
  fillW: number;
  specInt: number;
  wrap: number;
  black: number;
  contrast: number;
  shoulder: number;

  rough: number;
  roughVar: number;
  anisoRatio: number;
  sheen: number;
  sheenTint: [number, number, number];

  amp: number;
  weave: number;
  grain: number;
  vignette: number;
};

// The key sits low (small z) so shallow relief still throws long highlights.
// Its azimuth is aimed across the fold axis rather than down it -- a key
// raking along the folds barely changes N.L from crest to trough, and the
// folds wash out completely.
const KEY_DIR: [number, number, number] = [-0.55, 0.84, 0.30];
const FILL_DIR: [number, number, number] = [0.45, -0.70, 0.45];

const COMMON = {
  keyDir: KEY_DIR,
  fillDir: FILL_DIR,
  ambient: 0.008,
  diffuse: 1.15,
  fillW: 0.14,
  wrap: 0.18,
  shoulder: 0.90,
  rough: 0.44,
  roughVar: 0.075,
  anisoRatio: 2.1,
  amp: 1.05,
  weave: 0.016,
  grain: 0.028,
} as const;

export const PALETTES: SatinPalette[] = [
  {
    ...COMMON,
    id: "V1-SatinCharcoal",
    out: "V1_SatinCharcoal",
    label: "V1 - Charcoal / blue-grey",
    trough: "#020306",
    base: "#0a0d14",
    high: "#6a7a92",
    keyInt: 1.0,
    fillInt: 0.55,
    fillTint: [0.04, 0.07, 0.15],
    fillTintMix: 0.012,
    specInt: 20.0,
    black: 0.155,
    contrast: 1.15,
    sheen: 0.3,
    sheenTint: [0.16, 0.21, 0.32],
    vignette: 0.0,
  },
  {
    ...COMMON,
    id: "V2-SatinCrimson",
    out: "V2_SatinCrimson",
    label: "V2 - Deep crimson",
    trough: "#0d0203",
    base: "#2a0508",
    high: "#c0405a",
    keyInt: 0.94,
    fillInt: 0.45,
    fillTint: [0.14, 0.03, 0.06],
    fillTintMix: 0.012,
    specInt: 22.0,
    black: 0.19,
    contrast: 1.1,
    sheen: 0.34,
    sheenTint: [0.34, 0.1, 0.15],
    vignette: 0.0,
  },
  {
    ...COMMON,
    id: "V3-SatinIvory",
    out: "V3_SatinIvory",
    label: "V3 - Ivory / pearl",
    trough: "#b8ae9e",
    base: "#e8e2d8",
    high: "#fffdf8",
    // Ivory blows out at the exposure that suits charcoal: the key comes
    // down, and the tonal range is deliberately compressed toward the base.
    // Ivory's palette spans only #b8ae9e..#fffdf8, so the shading has to use
    // the whole luminance range or the folds vanish into a flat cream field.
    // Less wrap than the dark versions: the terminator is far less visible
    // against a light base, and the extra contrast is what shows the folds.
    keyInt: 1.55,
    fillInt: 0.55,
    wrap: 0.07,
    fillTint: [0.06, 0.05, 0.04],
    fillTintMix: 0.012,
    specInt: 4.5,
    black: 0.175,
    contrast: 1.0,
    shoulder: 0.8,
    rough: 0.48,
    sheen: 0.16,
    sheenTint: [0.16, 0.15, 0.13],
    vignette: 0.16,
  },
];

/** sRGB hex to linear-light RGB. */
export const hexToLinear = (hex: string): [number, number, number] => {
  const n = parseInt(hex.replace("#", ""), 16);
  const srgb = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => v / 255);
  return srgb.map((c) =>
    c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4),
  ) as [number, number, number];
};
