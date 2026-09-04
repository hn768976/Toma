/**
 * The two versions. Everything that separates them is data, so the shader
 * itself never branches on "which look" - which is what lets the sibling
 * black-hole project's compositions share this file.
 */

export type Vec3 = [number, number, number];

const srgbToLinear = (c: number) =>
  c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);

/** Ramp colours are authored as sRGB hex but consumed in linear light. */
export const hexToLinear = (hex: string): Vec3 => {
  const h = hex.replace("#", "");
  const n = parseInt(h, 16);
  return [
    srgbToLinear(((n >> 16) & 255) / 255),
    srgbToLinear(((n >> 8) & 255) / 255),
    srgbToLinear((n & 255) / 255),
  ];
};

/** Same ramp, luminance-matched greyscale, so V2 is V1 with the hue removed. */
const toMono = (c: Vec3): Vec3 => {
  const l = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  return [l, l, l];
};

export type Look = {
  // camera
  tiltDeg: number;
  camDist: number;
  zoom: number;
  // disc
  discIn: number;
  discOut: number;
  aniso: number;
  angScale: number;
  spinTurns: number;
  spinRef: number;
  spinMax: number;
  opacity: number;
  beaming: number;
  shimmer: number;
  secondary: number;
  // highlights & sky
  photonRing: number;
  stars: number;
  haze: number;
  hazeColor: Vec3;
  background: Vec3;
  ramp: [Vec3, Vec3, Vec3, Vec3, Vec3];
  steps: number;
  exposure: number;
  // post
  bloomThreshold: number;
  bloomKnee: number;
  bloomRadius: number;
  bloomStrength: number;
  grain: number;
  saturation: number;
};

/**
 * Nearly edge-on framing, shared by both versions.
 *
 * `zoom` is an inverse focal length. The shadow's impact parameter is
 * 3*sqrt(3)/2 rs = 2.589, so at camDist D it subtends atan(2.589 / D) and
 * lands at screen height atan(2.589/D) / zoom in units of frame height. With
 * D = 40 and zoom = 0.5885 that is 0.110 - a shadow 0.22 x frame height, as
 * specified. (The reference plate is framed tighter, nearer 0.33, but the
 * brief gives 0.22 explicitly and that is what this matches.)
 */
const FRAMING = {
  tiltDeg: 10,
  // Far enough back that the near rim is not wildly larger than the far
  // rim; at 25 the perspective made the lower wing swamp the upper one.
  camDist: 40,
  zoom: 0.5885,
  discIn: 3.0,
  discOut: 30.0,
  // Filaments live in log(radius), so they pack in at the inner edge and
  // spread toward the rim on their own.
  aniso: 40.0,
  // Small angular scale = few features around the orbit = long combed strands.
  angScale: 1.5,
  // "One and a bit outer revolutions" over the 15s loop.
  spinTurns: 1.15,
  spinRef: 22.0,
  spinMax: 16.0,
  opacity: 0.55,
  beaming: 0.3,
  shimmer: 0.1,
  // The secondary image is the sharp crescent under the shadow; the reference
  // has it tighter and hotter than the direct image above.
  secondary: 1.9,
  photonRing: 0.2,
  stars: 0.5,
  steps: 256,
  exposure: 3.3,
  bloomThreshold: 0.45,
  bloomKnee: 0.3,
  bloomRadius: 1.8,
  bloomStrength: 2.3,
  grain: 0.02,
} as const;

const GOLD_RAMP: [Vec3, Vec3, Vec3, Vec3, Vec3] = [
  hexToLinear("#5a2410"), // outer rim
  hexToLinear("#c25a28"),
  hexToLinear("#f0975a"),
  hexToLinear("#ffe3c0"),
  hexToLinear("#fff4ea"), // white hot inner edge, leaning pink
];

export const V1_GOLD: Look = {
  ...FRAMING,
  ramp: GOLD_RAMP,
  haze: 0.022,
  hazeColor: hexToLinear("#8a3a18"),
  background: hexToLinear("#050303"),
  saturation: 1.25,
};

export const V2_MONO: Look = {
  ...FRAMING,
  ramp: GOLD_RAMP.map(toMono) as [Vec3, Vec3, Vec3, Vec3, Vec3],
  haze: 0.022,
  hazeColor: toMono(hexToLinear("#8a3a18")),
  background: hexToLinear("#040404"),
  // Belt and braces: the photon ring and starfield carry a faint warm tint of
  // their own, and V2 is specified as having no tint at all.
  saturation: 0.0,
};
