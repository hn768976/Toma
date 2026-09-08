/**
 * The twelve compositions. Each entry fully determines the framing: which part
 * of the world fills the frame, where the light sits, how the surface waves,
 * where the sharp band of the depth-of-field falls, and how fine the dot grid
 * is. Viewport is the strongest differentiator, then dot pitch, then light.
 */

export type WaveComponent = {
  /** Peak vertical displacement in px at 4K. */
  amp: number;
  /** Wavelength in px at 4K. */
  len: number;
  /** Direction the wave travels, in degrees. */
  angle: number;
};

export type SharpBand = {
  /** Where the centre-line of the in-focus band sits, as a fraction of the frame. */
  anchor: readonly [number, number];
  /** Angle of the band in degrees (0 = horizontal). */
  angle: number;
  /** Half-thickness of the fully sharp band, px at 4K. */
  halfWidth: number;
  /** Distance over which blur ramps from none to maximum, px at 4K. */
  falloff: number;
};

export type CompositionSpec = {
  id: string;
  /** One-line description, echoed by the batch script. */
  note: string;
  /** Geographic centre of the frame, [lon, lat]. */
  center: readonly [number, number];
  /** Degrees of longitude spanned by the frame width. */
  lonSpan: number;
  /** Rotation applied to the whole field, in degrees. */
  tilt: number;
  /** Light position as a fraction of the frame; may fall outside 0..1. */
  light: readonly [number, number];
  /** Radius of the light falloff as a fraction of frame width. */
  lightRadius: number;
  /** How much the light lifts nearby dots. */
  lightGain: number;
  wave: readonly WaveComponent[];
  band: SharpBand;
  /** Spacing of the dot grid in px at 4K. */
  pitch: number;
  /** Edge length of a dot in px at 4K, at the sharp band. */
  dotSize: number;
};

export const COMPOSITIONS: Record<string, CompositionSpec> = {
  c01: {
    id: "c01",
    note: "world, light upper-right, gentle long waves, sharp band centre",
    center: [0, 12],
    lonSpan: 360,
    tilt: 0,
    light: [0.78, 0.17],
    lightRadius: 0.3,
    lightGain: 2.4,
    wave: [
      {amp: 139, len: 1750, angle: 8},
      {amp: 78, len: 980, angle: -22},
      {amp: 38, len: 470, angle: 40},
    ],
    band: {anchor: [0.5, 0.5], angle: 0, halfWidth: 400, falloff: 900},
    pitch: 15,
    dotSize: 7,
  },
  c02: {
    id: "c02",
    note: "world drawn in closer, light upper-left, short choppy waves, sharp band lower-left",
    center: [25, -5],
    lonSpan: 300,
    tilt: 0,
    light: [0.19, 0.14],
    lightRadius: 0.26,
    lightGain: 2.7,
    wave: [
      {amp: 37, len: 420, angle: 12},
      {amp: 19, len: 260, angle: -8},
      {amp: 9, len: 165, angle: 26},
    ],
    band: {anchor: [0.27, 0.79], angle: 34, halfWidth: 320, falloff: 780},
    pitch: 14,
    dotSize: 7,
  },
  c03: {
    id: "c03",
    note: "Atlantic-centred, light centre-top, medium waves, sharp band across the middle horizontally",
    center: [-36, 6],
    lonSpan: 132,
    tilt: 0,
    light: [0.44, 0.06],
    lightRadius: 0.33,
    lightGain: 2.5,
    wave: [
      {amp: 79, len: 900, angle: -6},
      {amp: 41, len: 520, angle: 30},
    ],
    band: {anchor: [0.5, 0.5], angle: 0, halfWidth: 300, falloff: 720},
    pitch: 19,
    dotSize: 8.5,
  },
  c04: {
    id: "c04",
    note: "Pacific-centred, light lower-right, long slow waves, sharp band diagonal",
    center: [-172, 4],
    lonSpan: 205,
    tilt: 0,
    light: [0.81, 0.82],
    lightRadius: 0.33,
    lightGain: 2.3,
    wave: [
      {amp: 183, len: 2300, angle: 18},
      {amp: 90, len: 1250, angle: -12},
    ],
    band: {anchor: [0.5, 0.5], angle: 32, halfWidth: 400, falloff: 900},
    pitch: 16,
    dotSize: 7.5,
  },
  c05: {
    id: "c05",
    note: "Europe and Africa filling frame, light right edge, tight waves, sharp band on the left third",
    center: [19, 14],
    lonSpan: 108,
    tilt: 0,
    light: [0.94, 0.44],
    lightRadius: 0.27,
    lightGain: 2.8,
    wave: [
      {amp: 26, len: 330, angle: -14},
      {amp: 14, len: 205, angle: 8},
      {amp: 6, len: 128, angle: -28},
    ],
    band: {anchor: [0.3, 0.5], angle: 90, halfWidth: 340, falloff: 800},
    pitch: 14,
    dotSize: 7,
  },
  c06: {
    id: "c06",
    note: "Asia and Australia, light upper-centre, medium waves, sharp band upper half",
    center: [122, 0],
    lonSpan: 116,
    tilt: 0,
    light: [0.56, 0.11],
    lightRadius: 0.3,
    lightGain: 2.5,
    wave: [
      {amp: 71, len: 860, angle: 26},
      {amp: 34, len: 470, angle: -34},
      {amp: 12, len: 260, angle: 4},
    ],
    band: {anchor: [0.5, 0.3], angle: 0, halfWidth: 430, falloff: 840},
    pitch: 12,
    dotSize: 6,
  },
  c07: {
    id: "c07",
    note: "Americas, light left edge, long waves at a steep angle, sharp band right of centre",
    center: [-86, 4],
    lonSpan: 150,
    tilt: 0,
    light: [0.07, 0.42],
    lightRadius: 0.32,
    lightGain: 2.9,
    wave: [
      {amp: 151, len: 1900, angle: 72},
      {amp: 73, len: 1020, angle: 58},
    ],
    band: {anchor: [0.64, 0.5], angle: 95, halfWidth: 360, falloff: 820},
    pitch: 15,
    dotSize: 7,
  },
  c08: {
    id: "c08",
    note: "world, very wide dot pitch (coarse field, large gaps), light centred, minimal wave",
    center: [0, 10],
    lonSpan: 345,
    tilt: 0,
    light: [0.5, 0.47],
    lightRadius: 0.34,
    lightGain: 2.2,
    wave: [
      {amp: 67, len: 2100, angle: 4},
      {amp: 26, len: 1100, angle: -20},
    ],
    band: {anchor: [0.5, 0.5], angle: 0, halfWidth: 520, falloff: 940},
    pitch: 34,
    dotSize: 9,
  },
  c09: {
    id: "c09",
    note: "world, very fine dot pitch (dense field), light lower-left, strong short waves",
    center: [-5, 8],
    lonSpan: 322,
    tilt: 0,
    light: [0.17, 0.83],
    lightRadius: 0.28,
    lightGain: 2.6,
    wave: [
      {amp: 46, len: 470, angle: -10},
      {amp: 23, len: 285, angle: 10},
      {amp: 9, len: 150, angle: -30},
    ],
    band: {anchor: [0.42, 0.58], angle: 12, halfWidth: 300, falloff: 740},
    pitch: 8,
    dotSize: 4.2,
  },
  c10: {
    id: "c10",
    note: "Northern hemisphere band, light upper-right, waves running diagonally, sharp band narrow and central",
    center: [14, 40],
    lonSpan: 238,
    tilt: 0,
    light: [0.8, 0.2],
    lightRadius: 0.26,
    lightGain: 2.9,
    wave: [
      {amp: 95, len: 1080, angle: 45},
      {amp: 46, len: 600, angle: 53},
      {amp: 17, len: 300, angle: 37},
    ],
    band: {anchor: [0.5, 0.5], angle: 6, halfWidth: 210, falloff: 640},
    pitch: 15,
    dotSize: 7,
  },
  c11: {
    id: "c11",
    note: "world tilted about -8 degrees, light upper-right, medium waves",
    center: [34, 20],
    lonSpan: 268,
    tilt: -8,
    light: [0.72, 0.22],
    lightRadius: 0.29,
    lightGain: 2.5,
    wave: [
      {amp: 80, len: 1000, angle: -4},
      {amp: 40, len: 560, angle: 22},
    ],
    band: {anchor: [0.46, 0.42], angle: -8, halfWidth: 330, falloff: 800},
    pitch: 18,
    dotSize: 8,
  },
  c12: {
    id: "c12",
    note: "world pulled back, light off-frame upper-right so only its falloff is visible, long waves, sharp band lower-right",
    center: [-20, 5],
    lonSpan: 396,
    tilt: 0,
    light: [1.1, -0.06],
    lightRadius: 0.46,
    lightGain: 2.8,
    wave: [
      {amp: 163, len: 2050, angle: 12},
      {amp: 85, len: 1180, angle: -18},
    ],
    band: {anchor: [0.68, 0.72], angle: -25, halfWidth: 380, falloff: 860},
    pitch: 15,
    dotSize: 7,
  },
};

export const COMPOSITION_IDS = Object.keys(COMPOSITIONS);
