export type Rgb = readonly [number, number, number];

export type Theme = {
  readonly id: string;
  /** Mirrors the whole layout on the X axis (globe and flare swap sides). */
  readonly mirror: boolean;
  readonly bgInner: Rgb;
  readonly bgOuter: Rgb;
  /** Faint lat/lon mesh covering the whole sphere. */
  readonly meshFront: Rgb;
  readonly meshBack: Rgb;
  /** Continent dots. */
  readonly landFront: Rgb;
  readonly landBack: Rgb;
  /** Fresnel glow at the sphere's limb. */
  readonly limb: Rgb;
  /** Emphasised latitude rings. */
  readonly ring: Rgb;
  readonly flareCore: Rgb;
  readonly flareBloom: Rgb;
  /** Horizontal dotted data streams. */
  readonly stream: Rgb;
  readonly up: Rgb;
  readonly down: Rgb;
  readonly neutralText: Rgb;
};

const CLASSIC: Theme = {
  id: "classic",
  mirror: false,
  bgInner: [7, 16, 33],
  bgOuter: [2, 4, 10],
  meshFront: [64, 150, 226],
  meshBack: [34, 86, 140],
  landFront: [150, 214, 255],
  landBack: [58, 120, 176],
  limb: [120, 196, 255],
  ring: [96, 178, 240],
  flareCore: [176, 226, 255],
  flareBloom: [26, 130, 224],
  stream: [46, 104, 158],
  up: [46, 226, 106],
  down: [240, 52, 60],
  neutralText: [188, 214, 238],
};

/**
 * Second version: layout mirrored, and the globe / flare / data streams
 * re-lit in cyan. The ticker chips deliberately stay market red/green so
 * the piece still reads as a financial scene.
 */
const CYAN_MIRROR: Theme = {
  id: "cyan-mirror",
  mirror: true,
  bgInner: [4, 24, 31],
  bgOuter: [1, 6, 9],
  meshFront: [38, 196, 202],
  meshBack: [22, 112, 120],
  landFront: [150, 253, 250],
  landBack: [38, 148, 156],
  limb: [110, 245, 244],
  ring: [64, 216, 216],
  flareCore: [198, 255, 254],
  flareBloom: [13, 162, 172],
  stream: [28, 130, 136],
  up: [46, 226, 106],
  down: [240, 52, 60],
  neutralText: [186, 238, 238],
};

export const THEMES = { classic: CLASSIC, "cyan-mirror": CYAN_MIRROR } as const;
export type ThemeId = keyof typeof THEMES;

export const rgba = (c: Rgb, alpha: number) =>
  `rgba(${c[0]},${c[1]},${c[2]},${alpha.toFixed(3)})`;
